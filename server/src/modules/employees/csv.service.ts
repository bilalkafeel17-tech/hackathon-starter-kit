import { parse } from 'csv-parse/sync';
import { Request } from 'express';
import { Department } from '../departments/department.model';
import { Designation } from '../designations/designation.model';
import { Employee } from './employee.model';
import { User } from '../users/user.model';
import { employeeService, EmployeeListQuery } from './employee.service';
import { isValidDateKey, todayInCompanyTz } from '../../utils/date';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

export interface RowError {
  row: number;
  field: string;
  reason: string;
}

export interface CsvValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RowError[];
  preview: Array<Record<string, any>>;
  parsedData: Array<Record<string, any>>;
}

export class CsvService {
  /**
   * Sanitizes a cell to prevent CSV injection (formula injection).
   */
  sanitizeCsvCell(val: unknown): string {
    if (val === null || val === undefined) return '';
    let str = String(val);

    // Prefix dangerous leading characters with a single quote
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Returns CSV template text with header and sample row.
   */
  getTemplate(): string {
    const headers = [
      'employeeCode',
      'name',
      'email',
      'phone',
      'gender',
      'dateOfBirth',
      'joiningDate',
      'department',
      'designation',
      'employmentType',
      'basicSalary',
    ];

    const exampleRow = [
      'EMP-0099',
      'Jane Doe',
      'jane.doe@example.com',
      '+1234567890',
      'female',
      '1992-06-15',
      '2026-01-15',
      'Engineering',
      'Senior Software Engineer',
      'full_time',
      '100000',
    ];

    return `${headers.join(',')}\n${exampleRow.join(',')}\n`;
  }

  /**
   * Parses and validates uploaded CSV buffer.
   */
  async validateCsv(buffer: Buffer): Promise<CsvValidationResult> {
    let content = buffer.toString('utf-8');
    // Strip UTF-8 BOM
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    let records: Array<Record<string, string>>;
    try {
      records = parse(content, {
        columns: (header) => header.map((h: string) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        delimiter: [',', ';'],
      });
    } catch (err: any) {
      throw AppError.unprocessable(`Failed to parse CSV file: ${err.message}`);
    }

    if (records.length === 0) {
      throw AppError.unprocessable('CSV file contains no data rows');
    }

    if (records.length > 100) {
      throw AppError.unprocessable(
        `Import file exceeds the limit of 100 data rows (found ${records.length} rows)`
      );
    }

    const errors: RowError[] = [];
    const validData: Array<Record<string, any>> = [];

    const fileEmails = new Set<string>();
    const fileCodes = new Set<string>();

    // Pre-load active departments and designations for fast lookup
    const [activeDepts, activeDesigs] = await Promise.all([
      Department.find({ isActive: true }).lean(),
      Designation.find({ isActive: true }).lean(),
    ]);

    const deptMap = new Map<string, any>();
    for (const d of activeDepts) {
      deptMap.set(d.name.toLowerCase().trim(), d);
    }

    const today = todayInCompanyTz();
    const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
    const maxJoiningDate = `${todayYear + 1}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2; // Line 1 is headers
      const row = records[i];
      let rowHasError = false;

      // 1. Name
      const name = row['name']?.trim();
      if (!name || name.length < 2 || name.length > 100) {
        errors.push({
          row: rowNum,
          field: 'name',
          reason: 'Name is required and must be between 2 and 100 characters',
        });
        rowHasError = true;
      }

      // 2. Email
      const email = row['email']?.toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({
          row: rowNum,
          field: 'email',
          reason: 'Valid email address is required',
        });
        rowHasError = true;
      } else if (fileEmails.has(email)) {
        errors.push({
          row: rowNum,
          field: 'email',
          reason: `Duplicate email '${email}' within file`,
        });
        rowHasError = true;
      } else {
        fileEmails.add(email);
        const [empExists, userExists] = await Promise.all([
          Employee.findOne({ email }),
          User.findOne({ email }),
        ]);
        if (empExists || userExists) {
          errors.push({
            row: rowNum,
            field: 'email',
            reason: `Email '${email}' already exists in the system`,
          });
          rowHasError = true;
        }
      }

      // 3. Employee Code (optional)
      let employeeCode: string | undefined = row['employeecode']?.trim().toUpperCase();
      if (employeeCode) {
        if (fileCodes.has(employeeCode)) {
          errors.push({
            row: rowNum,
            field: 'employeeCode',
            reason: `Duplicate employee code '${employeeCode}' within file`,
          });
          rowHasError = true;
        } else {
          fileCodes.add(employeeCode);
          const codeExists = await Employee.findOne({ employeeCode });
          if (codeExists) {
            errors.push({
              row: rowNum,
              field: 'employeeCode',
              reason: `Employee code '${employeeCode}' already exists in the system`,
            });
            rowHasError = true;
          }
        }
      }

      // 4. Phone
      const phone = row['phone']?.trim();
      const phoneDigits = phone ? phone.replace(/\D/g, '') : '';
      if (!phone || phoneDigits.length < 7 || phoneDigits.length > 15) {
        errors.push({
          row: rowNum,
          field: 'phone',
          reason: 'Phone number must contain between 7 and 15 digits',
        });
        rowHasError = true;
      }

      // 5. Gender (optional)
      const gender = row['gender']?.toLowerCase().trim();
      if (gender && !['male', 'female', 'other'].includes(gender)) {
        errors.push({
          row: rowNum,
          field: 'gender',
          reason: 'Gender must be male, female, or other',
        });
        rowHasError = true;
      }

      // 6. Date of Birth (optional)
      const dateOfBirth = row['dateofbirth']?.trim();
      if (dateOfBirth) {
        if (!isValidDateKey(dateOfBirth) || dateOfBirth >= today) {
          errors.push({
            row: rowNum,
            field: 'dateOfBirth',
            reason: 'Date of birth must be a valid past calendar date (YYYY-MM-DD)',
          });
          rowHasError = true;
        }
      }

      // 7. Joining Date (required)
      const joiningDate = row['joiningdate']?.trim();
      if (!joiningDate || !isValidDateKey(joiningDate) || joiningDate > maxJoiningDate) {
        errors.push({
          row: rowNum,
          field: 'joiningDate',
          reason: 'Joining date must be a valid calendar date not more than 1 year in future',
        });
        rowHasError = true;
      }

      // 8. Department (by name)
      const deptName = row['department']?.toLowerCase().trim();
      const matchedDept = deptName ? deptMap.get(deptName) : null;
      if (!matchedDept) {
        errors.push({
          row: rowNum,
          field: 'department',
          reason: `Department '${row['department'] || ''}' not found or inactive`,
        });
        rowHasError = true;
      }

      // 9. Designation (by title)
      const desigTitle = row['designation']?.toLowerCase().trim();
      let matchedDesig: any = null;
      if (matchedDept && desigTitle) {
        matchedDesig = activeDesigs.find(
          (d) =>
            d.title.toLowerCase().trim() === desigTitle &&
            (!d.departmentId || d.departmentId.toString() === matchedDept._id.toString())
        );
        if (!matchedDesig) {
          errors.push({
            row: rowNum,
            field: 'designation',
            reason: `Designation '${row['designation'] || ''}' not found or invalid for department '${matchedDept.name}'`,
          });
          rowHasError = true;
        }
      } else if (!desigTitle) {
        errors.push({
          row: rowNum,
          field: 'designation',
          reason: 'Designation is required',
        });
        rowHasError = true;
      }

      // 10. Employment Type (optional, default full_time)
      const employmentType = row['employmenttype']?.toLowerCase().trim() || 'full_time';
      if (!['full_time', 'part_time', 'contract'].includes(employmentType)) {
        errors.push({
          row: rowNum,
          field: 'employmentType',
          reason: 'Employment type must be full_time, part_time, or contract',
        });
        rowHasError = true;
      }

      // 11. Basic Salary
      const basicSalary = Number(row['basicsalary']);
      if (isNaN(basicSalary) || basicSalary <= 0 || basicSalary >= 100000000) {
        errors.push({
          row: rowNum,
          field: 'basicSalary',
          reason: 'Basic salary must be a positive number below 100,000,000',
        });
        rowHasError = true;
      }

      if (!rowHasError && matchedDept && matchedDesig) {
        validData.push({
          employeeCode,
          name,
          email,
          phone,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          joiningDate,
          departmentId: matchedDept._id.toString(),
          designationId: matchedDesig._id.toString(),
          employmentType,
          salary: {
            basic: basicSalary,
            extraAllowance: 0,
          },
        });
      }
    }

    return {
      totalRows: records.length,
      validRows: validData.length,
      invalidRows: records.length - validData.length,
      errors,
      preview: validData.slice(0, 10),
      parsedData: validData,
    };
  }

  /**
   * Executes real import or dry run.
   */
  async processImport(
    buffer: Buffer,
    dryRun: boolean,
    fileName: string,
    req?: Request
  ) {
    const validation = await this.validateCsv(buffer);

    if (dryRun) {
      return {
        totalRows: validation.totalRows,
        validRows: validation.validRows,
        invalidRows: validation.invalidRows,
        errors: validation.errors,
        preview: validation.preview,
      };
    }

    // All-or-nothing execution
    if (validation.errors.length > 0) {
      throw AppError.unprocessable('CSV import validation failed', validation.errors);
    }

    const createdEmployees: any[] = [];
    const credentials: Array<{ employeeCode: string; email: string; temporaryPassword: string }> = [];

    for (const data of validation.parsedData) {
      const result = await employeeService.registerEmployee(data as any, req);
      createdEmployees.push(result.employee);
      credentials.push({
        employeeCode: result.employee.employeeCode,
        email: result.employee.email,
        temporaryPassword: result.tempPassword,
      });
    }

    await auditService.log({
      req,
      action: 'EMPLOYEES_IMPORTED',
      entity: 'Employee',
      after: {
        count: createdEmployees.length,
        fileName,
      },
    });

    return {
      created: createdEmployees.length,
      credentials,
    };
  }

  /**
   * Generates sanitized CSV export stream.
   */
  async exportEmployees(
    filters: EmployeeListQuery,
    req?: Request
  ): Promise<{ csv: string; count: number }> {
    // List all matching employees without pagination limit
    const listResult = await employeeService.list(
      { ...filters, limit: 10000, page: 1 },
      { _id: (req as any).user._id, role: 'hr' }
    );

    const headers = [
      'employeeCode',
      'name',
      'email',
      'phone',
      'gender',
      'department',
      'designation',
      'employmentType',
      'status',
      'joiningDate',
      'exitDate',
    ];

    const lines: string[] = [headers.join(',')];

    for (const emp of listResult.employees) {
      const deptName = (emp.departmentId as any)?.name || '';
      const desigTitle = (emp.designationId as any)?.title || '';

      const row = [
        this.sanitizeCsvCell(emp.employeeCode),
        this.sanitizeCsvCell(emp.name),
        this.sanitizeCsvCell(emp.email),
        this.sanitizeCsvCell(emp.phone),
        this.sanitizeCsvCell(emp.gender || ''),
        this.sanitizeCsvCell(deptName),
        this.sanitizeCsvCell(desigTitle),
        this.sanitizeCsvCell(emp.employmentType),
        this.sanitizeCsvCell(emp.status),
        this.sanitizeCsvCell(emp.joiningDate),
        this.sanitizeCsvCell(emp.exitDate || ''),
      ];

      lines.push(row.join(','));
    }

    await auditService.log({
      req,
      action: 'EMPLOYEES_EXPORTED',
      entity: 'Employee',
      after: {
        count: listResult.employees.length,
        filters: {
          departmentId: filters.departmentId,
          designationId: filters.designationId,
          status: filters.status,
          search: filters.q,
        },
      },
    });

    return {
      csv: lines.join('\n') + '\n',
      count: listResult.employees.length,
    };
  }
}

export const csvService = new CsvService();
