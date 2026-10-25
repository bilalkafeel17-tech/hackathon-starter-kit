import { Types } from 'mongoose';
import { env } from '../../config/env';
import { AiLog } from './ai.model';
import { analyticsService } from '../dashboard/analytics.service';
import { leaveService } from '../leave/leave.service';
import { LeaveType } from '../leave-types/leave-type.model';
import { PayrollRun } from '../payroll/payroll.model';
import { Employee } from '../employees/employee.model';
import { todayInCompanyTz } from '../../utils/date';
import { AppError } from '../../utils/AppError';
import { Department } from '../departments/department.model';

interface CallerContext {
  userId: string;
  role: 'admin' | 'hr' | 'employee';
  employeeId?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const SYSTEM_POLICY_PROMPT = `You are HCM Lite AI, an intelligent, professional HR assistant for HCM Lite.
You must adhere strictly to these company policies and rules:
1. Working hours: Office begins at 09:00 with a 15-minute grace period. Check-in after 09:15 is considered 'late'.
2. Half-day rule: Employees who work fewer than 5 hours on a working day are marked 'half_day'.
3. Weekend days: Saturday and Sunday are regular weekends.
4. Leaves: Leaves must be applied in advance or within 7 days in the past. Overlapping leaves are rejected. Unpaid leaves have no balance cap.
5. Annual Tax Slabs:
   - PKR 0 to 600,000: 0%
   - PKR 600,001 to 1,200,000: 5% of amount above 600,000
   - PKR 1,200,001 to 2,400,000: PKR 30,000 + 15% above 1,200,000
   - PKR 2,400,001 to 3,600,000: PKR 210,000 + 25% above 2,400,000
   - Above PKR 3,600,000: PKR 510,000 + 35% above 3,600,000
   Monthly tax is annual tax divided by 12.
6. Communication style:
   - Maintain a courteous, calm, concise tone. No emojis anywhere.
   - If the user writes in Roman Urdu (e.g. "Meri chuttiyan kitni bachi hain?", "Kal ki attendance check karein"), respond accurately in Roman Urdu.
   - If the user writes in English, reply in English.
7. Privacy and Scope:
   - NEVER disclose salaries, payslips, or personal contact info of any individual to another employee.
   - Only Admin and HR may see payroll and company-wide employee lists.
   - You NEVER claim to create, update, or save records. You are strictly an informational assistant.
8. Answer only from known policy and tool data. If you do not know or data is not provided, state that clearly.`;

export class AiService {
  /**
   * Rate-limiting check: max 20 requests per user per hour.
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await AiLog.countDocuments({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: oneHourAgo },
    });
    if (count >= 20) {
      throw new AppError(
        'AI rate limit reached (maximum 20 requests per hour). Please try again later.',
        429,
        'AI_RATE_LIMIT_EXCEEDED'
      );
    }
  }

  private getAiProviderConfig(): AiProviderConfig | null {
    const provider = env.AI_PROVIDER;
    const providerKey =
      provider === 'gemini' ? env.GEMINI_API_KEY : provider === 'grok' ? env.GROK_API_KEY : undefined;
    const apiKey = providerKey || env.AI_API_KEY;
    const hasAnyKey = Boolean(env.AI_API_KEY || env.GEMINI_API_KEY || env.GROK_API_KEY);

    if (!apiKey) {
      if (hasAnyKey) {
        const keyName = provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'grok' ? 'GROK_API_KEY' : 'AI_API_KEY';
        throw new AppError(`Set ${keyName} for the selected AI provider.`, 500, 'AI_PROVIDER_NOT_CONFIGURED');
      }
      return null;
    }

    const defaults = {
      openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
      gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash',
      },
      grok: { baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini' },
    }[provider];

    return {
      apiKey,
      baseUrl: env.AI_BASE_URL || defaults.baseUrl,
      model: env.AI_MODEL || defaults.model,
    };
  }

  /**
   * Dispatches and scopes tool calls on the server.
   */
  async executeTool(name: string, args: Record<string, any>, context: CallerContext): Promise<string> {
    try {
      switch (name) {
        case 'get_headcount': {
          const count = await analyticsService.getHeadcount(args.asOfDate, args.departmentId);
          return JSON.stringify({ headcount: count, asOfDate: args.asOfDate || todayInCompanyTz() });
        }

        case 'get_attendance_summary': {
          const summary = await analyticsService.getAttendanceSummary({
            from: args.from,
            to: args.to,
            departmentId: args.departmentId,
          });
          return JSON.stringify(summary);
        }

        case 'get_late_comers': {
          if (context.role === 'employee') {
            return JSON.stringify({ error: 'Access denied. Only HR and Admin can view company-wide late arrivals.' });
          }
          const lateComers = await analyticsService.getTopLateComers({
            from: args.from,
            to: args.to,
            departmentId: args.departmentId,
          });
          return JSON.stringify(lateComers);
        }

        case 'get_leave_summary': {
          const today = todayInCompanyTz();
          const month = args.month || today.slice(0, 7);
          const leaves = await leaveService.listLeaves(
            { role: context.role, employeeId: context.employeeId },
            {
              from: `${month}-01`,
              status: 'approved',
            }
          );
          return JSON.stringify({
            month,
            approvedLeavesCount: leaves.leaves.length,
            records: leaves.leaves.slice(0, 10).map((l: any) => ({
              employeeCode: l.employeeId?.employeeCode,
              employeeName: l.employeeId?.name,
              leaveType: l.leaveTypeId?.name,
              workingDays: l.workingDays,
              startDate: l.startDate,
              endDate: l.endDate,
            })),
          });
        }

        case 'get_my_leave_balance': {
          if (!context.employeeId) {
            return JSON.stringify({ error: 'Caller does not have an associated employee profile.' });
          }
          const balances = await leaveService.getBalances(context.employeeId);
          return JSON.stringify(balances);
        }

        case 'get_payroll_summary': {
          if (context.role === 'employee') {
            return JSON.stringify({
              error: 'Access denied. You do not have permission to view company-wide payroll information.',
            });
          }
          const runs = await PayrollRun.find().sort({ month: -1 }).limit(3).lean();
          return JSON.stringify(
            runs.map((r) => ({
              month: r.month,
              status: r.status,
              employeeCount: r.totals.employeeCount,
              gross: r.totals.gross,
              net: r.totals.net,
            }))
          );
        }

        case 'search_employees': {
          if (context.role === 'employee') {
            return JSON.stringify({
              error: 'Access denied. Only HR and Admin can search the full employee roster.',
            });
          }
          const query: Record<string, any> = { status: { $ne: 'exited' } };
          if (args.departmentId) query.departmentId = new Types.ObjectId(args.departmentId);
          if (args.query) {
            query.$or = [
              { name: { $regex: args.query, $options: 'i' } },
              { employeeCode: { $regex: args.query, $options: 'i' } },
            ];
          }
          const emps = await Employee.find(query)
            .select('employeeCode name status departmentId designationId')
            .populate('departmentId', 'name')
            .populate('designationId', 'title')
            .limit(10)
            .lean();
          return JSON.stringify(
            emps.map((e: any) => ({
              employeeCode: e.employeeCode,
              name: e.name,
              department: e.departmentId?.name,
              designation: e.designationId?.title,
            }))
          );
        }

        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (err: any) {
      return JSON.stringify({ error: err.message || 'Tool execution failed' });
    }
  }

  /**
   * Main AI Chat Completion with tool calling support.
   */
  async chat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: CallerContext
  ) {
    await this.checkRateLimit(context.userId);
    const start = Date.now();
    const toolsUsed: string[] = [];

    try {
      const providerConfig = this.getAiProviderConfig();
      if (providerConfig) {
        const result = await this.callExternalLlm(message, history, context, toolsUsed, providerConfig);
        const latency = Date.now() - start;
        await AiLog.create({
          userId: new Types.ObjectId(context.userId),
          role: context.role,
          endpoint: '/api/ai/chat',
          promptLength: message.length,
          toolsUsed,
          latencyMs: latency,
          success: true,
        });
        return {
          message: result,
          toolsUsed,
          aiGenerated: true,
        };
      }

      // Fallback local heuristic router when AI key is not supplied
      const localResult = await this.fallbackChat(message, context, toolsUsed);
      const latency = Date.now() - start;
      await AiLog.create({
        userId: new Types.ObjectId(context.userId),
        role: context.role,
        endpoint: '/api/ai/chat',
        promptLength: message.length,
        toolsUsed,
        latencyMs: latency,
        success: true,
      });

      return {
        message: localResult,
        toolsUsed,
        aiGenerated: true,
      };
    } catch (err: any) {
      const latency = Date.now() - start;
      await AiLog.create({
        userId: new Types.ObjectId(context.userId),
        role: context.role,
        endpoint: '/api/ai/chat',
        promptLength: message.length,
        toolsUsed,
        latencyMs: latency,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * External LLM call using OpenAI-compatible specification.
   */
  private async callExternalLlm(
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: CallerContext,
    toolsUsedCollector: string[],
    providerConfig: AiProviderConfig
  ): Promise<string> {
    const { apiKey, baseUrl, model } = providerConfig;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_headcount',
          description: 'Get active company headcount as of a date or department',
          parameters: {
            type: 'object',
            properties: {
              asOfDate: { type: 'string', description: 'YYYY-MM-DD date' },
              departmentId: { type: 'string', description: 'Department ID' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_attendance_summary',
          description: 'Get summary of attendance (present, late, half-day rates)',
          parameters: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Start date YYYY-MM-DD' },
              to: { type: 'string', description: 'End date YYYY-MM-DD' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_late_comers',
          description: 'Get top employees with late check-ins (HR/Admin only)',
          parameters: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Start date YYYY-MM-DD' },
              to: { type: 'string', description: 'End date YYYY-MM-DD' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_my_leave_balance',
          description: 'Get leave balances for the currently logged in employee',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_leave_summary',
          description: 'Get leave usage and approved leaves summary',
          parameters: {
            type: 'object',
            properties: { month: { type: 'string', description: 'YYYY-MM' } },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_payroll_summary',
          description: 'Get company payroll summary and recent runs (HR/Admin only)',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_employees',
          description: 'Search employees by name or code (HR/Admin only)',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search term' },
              departmentId: { type: 'string', description: 'Department ID' },
            },
          },
        },
      },
    ];

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_POLICY_PROMPT },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMessage },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI provider returned ${response.status}.`);
      }

      const data: any = await response.json();
      const choice = data.choices?.[0]?.message;

      if (!choice) {
        throw new Error('No completion returned from AI service');
      }

      // If the model requested tool calls
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const toolCall = choice.tool_calls[0];
        const fnName = toolCall.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          fnArgs = {};
        }

        toolsUsedCollector.push(fnName);
        const toolResult = await this.executeTool(fnName, fnArgs, context);

        // Follow up with tool result
        const followUpMessages = [
          ...messages,
          choice,
          {
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            name: fnName,
            content: toolResult,
          },
        ];

        const followUpResponse = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: followUpMessages,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        if (!followUpResponse.ok) {
          throw new Error(`AI provider returned ${followUpResponse.status} for the tool result.`);
        }

        const followUpData: any = await followUpResponse.json();
        return followUpData.choices?.[0]?.message?.content || toolResult;
      }

      return choice.content || 'I have processed your request.';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new AppError('AI request timed out after 15 seconds. Please try again.', 504, 'AI_TIMEOUT');
      }
      throw new AppError(
        'AI provider request failed. Check the selected provider, model, and API key.',
        502,
        'AI_PROVIDER_ERROR'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Deterministic local fallback assistant (handles English & Roman Urdu, role scoping, and real tool data).
   */
  private async fallbackChat(
    message: string,
    context: CallerContext,
    toolsUsedCollector: string[]
  ): Promise<string> {
    const text = message.toLowerCase();
    const isUrdu =
      text.includes('kya') ||
      text.includes('chutti') ||
      text.includes('kitni') ||
      text.includes('hain') ||
      text.includes('meri') ||
      text.includes('mujhe') ||
      text.includes('kaun') ||
      text.includes('batao');

    // Salary inquiry for someone else
    if (
      (text.includes('salary') || text.includes('tankhwah') || text.includes('pay')) &&
      !text.includes('my salary') &&
      !text.includes('meri salary') &&
      context.role === 'employee'
    ) {
      return isUrdu
        ? 'Maazrat, security policy ke tehat main kisi doosray mulazim ki salary ya zati maloomat share nahi kar sakta.'
        : 'I cannot disclose salary or personal information of other employees due to security and privacy policies.';
    }

    // Leave balance inquiry
    if (
      text.includes('leave') ||
      text.includes('chutti') ||
      text.includes('balance') ||
      text.includes('remaining')
    ) {
      if (context.employeeId) {
        toolsUsedCollector.push('get_my_leave_balance');
        const balances = await leaveService.getBalances(context.employeeId);
        const lines = balances.map(
          (b) => `- ${b.leaveType.name}: ${b.remaining !== null ? b.remaining : 'Unlimited'} days remaining (Quota: ${b.quota ?? 'Unlimited'}, Used: ${b.used}, Pending: ${b.pending})`
        );
        if (isUrdu) {
          return `Aapke leaves ka balance darj zail hai:\n${lines.join('\n')}`;
        }
        return `Here is your current leave balance:\n${lines.join('\n')}`;
      }
      toolsUsedCollector.push('get_leave_summary');
      const leaves = await leaveService.listLeaves(
        { role: context.role, employeeId: context.employeeId },
        { status: 'approved' }
      );
      return `Total approved leave applications currently recorded: ${leaves.leaves.length}.`;
    }

    // Headcount inquiry
    if (text.includes('headcount') || text.includes('how many employees') || text.includes('kitnay mulazmeen')) {
      toolsUsedCollector.push('get_headcount');
      const count = await analyticsService.getHeadcount();
      if (isUrdu) {
        return `Company mein is waqt kul ${count} active mulazmeen kaam kar rahe hain.`;
      }
      return `The current active employee headcount is ${count}.`;
    }

    // Attendance inquiry
    if (text.includes('attendance') || text.includes('late') || text.includes('hazri')) {
      if (text.includes('late') && context.role !== 'employee') {
        toolsUsedCollector.push('get_late_comers');
        const late = await analyticsService.getTopLateComers();
        if (late.length === 0) {
          return isUrdu
            ? 'Is period mein koi late arrivals record nahi huay.'
            : 'No late arrivals recorded for this period.';
        }
        const names = late.map((l: any) => `${l.name} (${l.lateCount} late)`).join(', ');
        return `Top late arrivals: ${names}.`;
      }
      toolsUsedCollector.push('get_attendance_summary');
      const summary = await analyticsService.getAttendanceSummary();
      return `Attendance Summary: Present: ${summary.present}, Late: ${summary.late}, Half-day: ${summary.halfDay}, Overall rate: ${summary.rate}%.`;
    }

    // Payroll inquiry
    if (text.includes('payroll') || text.includes('payslip') || text.includes('tankhwah')) {
      if (context.role === 'employee') {
        return isUrdu
          ? 'Aap apni finalized payslips Payslips tab mein ja kar check aur PDF download kar saktay hain.'
          : 'You can view and download your finalized payslips directly under the Payslips section.';
      }
      toolsUsedCollector.push('get_payroll_summary');
      const runs = await PayrollRun.find().sort({ month: -1 }).limit(1).lean();
      if (runs.length === 0) {
        return 'No payroll runs have been generated yet.';
      }
      const latest = runs[0];
      return `Latest Payroll Run (${latest.month}): Status is ${latest.status}, covering ${latest.totals.employeeCount} employees with total gross PKR ${(latest.totals.gross / 100).toLocaleString()}.`;
    }

    // Office timing / Policy inquiry
    if (text.includes('timing') || text.includes('office hour') || text.includes('waqt') || text.includes('rule')) {
      if (isUrdu) {
        return 'Daftar ke auqat subah 09:00 baje se shuru hotay hain. 15 minute ka grace period hai (09:15 ke baad late mark hoga). 5 ghantay se kam kaam par half-day lagta hai.';
      }
      return 'Office begins at 09:00 with a 15-minute grace period. Check-in after 09:15 is marked late. Working under 5 hours counts as a half day.';
    }

    // Default polite response
    if (isUrdu) {
      return 'Main HCM Lite AI assistant hoon. Aap mujh se company policies, attendance rules, tax slabs ya apne leave balance ke mutaliq sawal pooch saktay hain.';
    }
    return 'I am HCM Lite AI assistant. You can ask me about company policies, attendance rules, tax calculation slabs, or your leave balances.';
  }

  /**
   * Generates 3-5 concise bullet points summarizing dashboard KPIs.
   */
  async getDashboardSummary(
    filters: { from?: string; to?: string; departmentId?: string },
    context: CallerContext
  ) {
    await this.checkRateLimit(context.userId);
    const start = Date.now();

    const data =
      context.role === 'admin'
        ? await analyticsService.getAdminDashboard(filters)
        : await analyticsService.getHrDashboard(filters);

    const kpiSummary = JSON.stringify(data.kpis);
    const latency = Date.now() - start;

    await AiLog.create({
      userId: new Types.ObjectId(context.userId),
      role: context.role,
      endpoint: '/api/ai/dashboard-summary',
      promptLength: kpiSummary.length,
      toolsUsed: ['analytics_dashboard'],
      latencyMs: latency,
      success: true,
    });

    const k = data.kpis;
    const bullets: string[] = [];

    bullets.push(`Total active employee headcount currently stands at ${k.headcount}.`);
    if ('attendanceRate' in k) {
      bullets.push(`Attendance rate is recorded at ${k.attendanceRate}% with ${k.latePercent || 0}% late arrivals.`);
    }
    if ('pendingApprovals' in k) {
      bullets.push(`There are ${k.pendingApprovals} pending items requiring action (${k.pendingLeaves} leaves, ${k.pendingCorrections} corrections).`);
    }
    if ('payrollCost' in k) {
      bullets.push(`Total payroll cost across the organization is PKR ${(k.payrollCost / 100).toLocaleString()}.`);
    }
    if ('attritionYtd' in k) {
      bullets.push(`Year-to-date attrition rate is currently ${k.attritionYtd}%.`);
    }

    return {
      bullets: bullets.slice(0, 5),
      aiGenerated: true,
    };
  }

  /**
   * Smart leave parser: turns natural language into structured leave request without saving.
   */
  async smartLeave(text: string, context: CallerContext) {
    await this.checkRateLimit(context.userId);
    const today = todayInCompanyTz();
    const activeLeaveTypes = await LeaveType.find({ isActive: true }).lean();

    if (activeLeaveTypes.length === 0) {
      throw new AppError('No active leave types configured in the company.', 422, 'NO_LEAVE_TYPES');
    }

    // Identify leave type match from text
    const lower = text.toLowerCase();
    let matchedType = activeLeaveTypes.find((lt) => lower.includes(lt.name.toLowerCase()));
    if (!matchedType) {
      // Default to annual or casual if available, or first active
      matchedType =
        activeLeaveTypes.find((lt) => lt.name.toLowerCase().includes('annual')) ||
        activeLeaveTypes.find((lt) => lt.name.toLowerCase().includes('casual')) ||
        activeLeaveTypes[0];
    }

    // Date resolution
    let startDate = today;
    let endDate = today;

    // Check for relative words
    if (lower.includes('tomorrow') || lower.includes('kal')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      startDate = d.toISOString().slice(0, 10);
      endDate = startDate;
    } else if (lower.includes('next monday')) {
      const d = new Date();
      const day = d.getDay();
      const diff = (8 - day) % 7 || 7;
      d.setDate(d.getDate() + diff);
      startDate = d.toISOString().slice(0, 10);
      endDate = startDate;
    }

    return {
      leaveTypeId: matchedType._id.toString(),
      leaveTypeName: matchedType.name,
      startDate,
      endDate,
      reason: text.length >= 10 ? text : 'Leave requested via AI assistant',
      aiGenerated: true,
    };
  }
}

export const aiService = new AiService();
