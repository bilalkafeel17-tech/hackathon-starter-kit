import PDFDocument from 'pdfkit';

export interface PayslipPdfData {
  companyName: string;
  month: string;
  employee: {
    code: string;
    name: string;
    email: string;
    department: string;
    designation: string;
    joiningDate: string;
  };
  earnings: {
    basic: number;
    hra: number;
    medical: number;
    extraAllowance: number;
    gross: number;
  };
  deductions: {
    absentDays: number;
    unpaidLeaveDays: number;
    halfDays: number;
    lateCount: number;
    totalDeductions: number;
  };
  tax: {
    annualTaxable: number;
    monthlyTax: number;
  };
  adjustments?: {
    amount: number;
    reason: string;
  };
  netPay: number;
}

export function generatePayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // Header
    doc.fontSize(18).text(data.companyName.toUpperCase(), { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor('#555555').text(`PAYSLIP — ${data.month}`, { align: 'center' });
    doc.moveDown(1);

    doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // Employee Details Section
    doc.fillColor('#000000').fontSize(11);
    const col1 = 50;
    const col2 = 300;
    const startY = doc.y;

    doc.text(`Employee Code: ${data.employee.code}`, col1, startY);
    doc.text(`Name: ${data.employee.name}`, col1, startY + 16);
    doc.text(`Department: ${data.employee.department}`, col1, startY + 32);

    doc.text(`Designation: ${data.employee.designation}`, col2, startY);
    doc.text(`Email: ${data.employee.email}`, col2, startY + 16);
    doc.text(`Joining Date: ${data.employee.joiningDate}`, col2, startY + 32);

    doc.y = startY + 54;
    doc.moveDown(1);
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // Earnings and Deductions Table
    const tableTop = doc.y;
    doc.fontSize(12).fillColor('#000000').text('EARNINGS', 50, tableTop);
    doc.text('DEDUCTIONS & TAX', 300, tableTop);
    doc.moveDown(0.5);

    let curY = doc.y + 5;
    doc.fontSize(10).fillColor('#333333');

    // Earnings rows
    doc.text('Basic Salary:', 50, curY);
    doc.text(`${data.earnings.basic.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 220, curY, { align: 'right' });
    curY += 16;

    doc.text('HRA (40%):', 50, curY);
    doc.text(`${data.earnings.hra.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 220, curY, { align: 'right' });
    curY += 16;

    doc.text('Medical (10%):', 50, curY);
    doc.text(`${data.earnings.medical.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 220, curY, { align: 'right' });
    curY += 16;

    if (data.earnings.extraAllowance > 0) {
      doc.text('Extra Allowance:', 50, curY);
      doc.text(`${data.earnings.extraAllowance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 220, curY, { align: 'right' });
      curY += 16;
    }

    doc.font('Helvetica-Bold').text('Total Gross Pay:', 50, curY);
    doc.text(`${data.earnings.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 220, curY, { align: 'right' });

    // Deductions rows
    let dedY = tableTop + 20;
    doc.font('Helvetica');
    doc.text(`Attendance Deductions (${data.deductions.absentDays}d absent, ${data.deductions.halfDays} half-d):`, 300, dedY);
    doc.text(`${data.deductions.totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 530, dedY, { align: 'right' });
    dedY += 16;

    doc.text('Income Tax (Monthly):', 300, dedY);
    doc.text(`${data.tax.monthlyTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 530, dedY, { align: 'right' });
    dedY += 16;

    if (data.adjustments && data.adjustments.amount !== 0) {
      doc.text(`Adjustment (${data.adjustments.reason}):`, 300, dedY);
      doc.text(`${data.adjustments.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 530, dedY, { align: 'right' });
      dedY += 16;
    }

    const totalDed = Math.round((data.deductions.totalDeductions + data.tax.monthlyTax - (data.adjustments?.amount || 0)) * 100) / 100;
    doc.font('Helvetica-Bold').text('Total Deductions:', 300, dedY);
    doc.text(`${totalDed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 530, dedY, { align: 'right' });

    doc.font('Helvetica');
    doc.y = Math.max(curY, dedY) + 30;
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // Net Pay Callout
    doc.rect(40, doc.y, 515, 45).fillAndStroke('#f6f6f6', '#dddddd');
    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('NET PAYABLE:', 60, doc.y + 15);
    doc.fontSize(16).fillColor('#1b5e20').text(`PKR ${data.netPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 350, doc.y + 13, { align: 'right' });

    doc.moveDown(4);
    doc.fontSize(9).font('Helvetica').fillColor('#888888').text('This is a system generated payslip and requires no physical signature.', 40, doc.y, { align: 'center' });

    doc.end();
  });
}
