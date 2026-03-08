-- Create communication_templates table
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    body TEXT NOT NULL,
    sector VARCHAR(50),
    admin_id VARCHAR(255),
    company_name VARCHAR(255),
    user_id VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create communication_logs table
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id VARCHAR(255) NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    admin_id VARCHAR(255),
    company_name VARCHAR(255),
    sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create automation_schedules table
CREATE TABLE IF NOT EXISTS public.automation_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    time VARCHAR(10) NOT NULL,
    days VARCHAR(255),
    template_id UUID,
    sms_message TEXT,
    whatsapp_message TEXT,
    target_filter VARCHAR(100) NOT NULL DEFAULT 'due_followup',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMP,
    admin_id VARCHAR(255),
    company_name VARCHAR(255),
    user_id VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comm_templates_user_id ON public.communication_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_templates_admin_id ON public.communication_templates(admin_id);
CREATE INDEX IF NOT EXISTS idx_comm_templates_company ON public.communication_templates(company_name);

CREATE INDEX IF NOT EXISTS idx_comm_logs_lead_id ON public.communication_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_user_id ON public.communication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_admin_id ON public.communication_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_company ON public.communication_logs(company_name);

CREATE INDEX IF NOT EXISTS idx_automation_schedules_user_id ON public.automation_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_schedules_admin_id ON public.automation_schedules(admin_id);
CREATE INDEX IF NOT EXISTS idx_automation_schedules_company ON public.automation_schedules(company_name);
CREATE INDEX IF NOT EXISTS idx_automation_schedules_active ON public.automation_schedules(is_active);
