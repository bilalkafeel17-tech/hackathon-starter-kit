import { Settings } from '../settings/settings.model';
import { Department } from '../departments/department.model';
import { Designation } from '../designations/designation.model';
import { LeaveType } from '../leave-types/leave-type.model';
import { Holiday } from '../holidays/holiday.model';
import { User } from '../users/user.model';

export interface OrgReadiness {
  companyName: boolean;
  officeLocation: boolean;
  departments: number;
  designations: number;
  leaveTypes: number;
  holidays: number;
  hrUsers: number;
  isReadyForEmployees: boolean;
}

export class OrgService {
  async getReadiness(): Promise<OrgReadiness> {
    const [settings, deptCount, desigCount, leaveCount, holidayCount, hrCount] =
      await Promise.all([
        Settings.findOne({ key: 'company' }).lean(),
        Department.countDocuments({ isActive: true }),
        Designation.countDocuments({ isActive: true }),
        LeaveType.countDocuments({ isActive: true }),
        Holiday.countDocuments({ isActive: true }),
        User.countDocuments({ role: 'hr', isActive: true }),
      ]);

    const hasCompanyName = Boolean(settings?.companyName && settings.companyName.trim().length > 0);
    const hasOfficeLocation = Boolean(
      settings?.office?.lat !== undefined && settings?.office?.lng !== undefined
    );

    const isReadyForEmployees = Boolean(
      hasCompanyName && deptCount > 0 && leaveCount > 0
    );

    return {
      companyName: hasCompanyName,
      officeLocation: hasOfficeLocation,
      departments: deptCount,
      designations: desigCount,
      leaveTypes: leaveCount,
      holidays: holidayCount,
      hrUsers: hrCount,
      isReadyForEmployees,
    };
  }
}

export const orgService = new OrgService();
