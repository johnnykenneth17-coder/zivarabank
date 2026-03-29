-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    id_number VARCHAR(50),
    id_type VARCHAR(50),
    kyc_status VARCHAR(20) DEFAULT 'pending',
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    is_frozen BOOLEAN DEFAULT false,
    freeze_reason TEXT,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(50) DEFAULT 'checking',
    currency VARCHAR(3) DEFAULT 'USD',
    balance DECIMAL(15,2) DEFAULT 0.00,
    available_balance DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active',
    daily_limit DECIMAL(15,2) DEFAULT 10000.00,
    monthly_limit DECIMAL(15,2) DEFAULT 50000.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cards table
CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    card_number VARCHAR(20) UNIQUE NOT NULL,
    card_type VARCHAR(20) DEFAULT 'debit',
    expiry_date DATE NOT NULL,
    cvv VARCHAR(4) NOT NULL,
    card_status VARCHAR(20) DEFAULT 'inactive',
    spending_limit DECIMAL(15,2) DEFAULT 5000.00,
    is_virtual BOOLEAN DEFAULT false,
    purchase_date TIMESTAMP,
    purchase_method VARCHAR(50),
    purchase_reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    from_account_id UUID REFERENCES accounts(id),
    to_account_id UUID REFERENCES accounts(id),
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    converted_amount DECIMAL(15,2),
    converted_currency VARCHAR(3),
    exchange_rate DECIMAL(10,6),
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    requires_otp BOOLEAN DEFAULT false,
    otp_code VARCHAR(6),
    otp_verified BOOLEAN DEFAULT false,
    otp_expiry TIMESTAMP,
    is_bulk BOOLEAN DEFAULT false,
    bulk_reference VARCHAR(100),
    is_admin_adjusted BOOLEAN DEFAULT false,
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Beneficiaries table
CREATE TABLE beneficiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    beneficiary_name VARCHAR(200) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    bank_name VARCHAR(200),
    bank_code VARCHAR(50),
    relationship VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bills table
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    biller_name VARCHAR(200) NOT NULL,
    biller_account VARCHAR(100),
    category VARCHAR(100),
    amount DECIMAL(15,2),
    due_date DATE,
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Budgets table
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    spent DECIMAL(15,2) DEFAULT 0.00,
    month INTEGER,
    year INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- OTP table
CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    otp_type VARCHAR(50) NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    is_used BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);



-- Support tickets table
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    message TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Admin settings table
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin settings
INSERT INTO admin_settings (setting_key, setting_value) VALUES
('otp_mode', 'off'),
('withdrawal_otp_required', 'false'),
('transfer_otp_required', 'false'),
('freeze_otp_required', 'true'),
('card_purchase_method', 'crypto'),
('default_currency', 'USD'),
('transaction_fee_percentage', '0.5'),
('support_email', 'support@bank.com');

-- Currency exchange rates table
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(10,6) NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(from_currency, to_currency)
);

-- Insert default exchange rates
INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
('USD', 'EUR', 0.92),
('USD', 'GBP', 0.79),
('EUR', 'USD', 1.09),
('GBP', 'USD', 1.27);

-- Admin actions log
CREATE TABLE admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    target_user_id UUID REFERENCES users(id),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_account_number ON accounts(account_number);
CREATE INDEX idx_transactions_from_account ON transactions(from_account_id);
CREATE INDEX idx_transactions_to_account ON transactions(to_account_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_otps_user_id ON otps(user_id);
CREATE INDEX idx_otps_otp_code ON otps(otp_code);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Function to generate account number
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.account_number = 'ACC' || LPAD(CAST(FLOOR(RANDOM() * 1000000) AS TEXT), 10, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate account number
CREATE TRIGGER generate_account_number_trigger
    BEFORE INSERT ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION generate_account_number();

-- Function to generate transaction ID
CREATE OR REPLACE FUNCTION generate_transaction_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.transaction_id = 'TXN' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(CAST(FLOOR(RANDOM() * 10000) AS TEXT), 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for transaction ID
CREATE TRIGGER generate_transaction_id_trigger
    BEFORE INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION generate_transaction_id();

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ticket_number = 'TKT' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(CAST(FLOOR(RANDOM() * 1000) AS TEXT), 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ticket number
CREATE TRIGGER generate_ticket_number_trigger
    BEFORE INSERT ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_number();




    -- 1. New table for live support chat
CREATE TABLE live_support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    admin_id UUID REFERENCES users(id),
    message TEXT NOT NULL,
    is_from_admin BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'sent',          -- sent, delivered, read
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_live_support_user ON live_support_messages(user_id);
CREATE INDEX idx_live_support_created ON live_support_messages(created_at);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE live_support_messages;

-- RLS Policies
ALTER TABLE live_support_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own chat
CREATE POLICY "Users see own live chat" ON live_support_messages
    FOR ALL USING (user_id = auth.uid());

-- Admins see everything
CREATE POLICY "Admins see all live chats" ON live_support_messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );







    -- Add Money Requests Table (for admin review)
CREATE TABLE add_money_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Card Details (stored temporarily until approved or declined)
    card_number VARCHAR(20) NOT NULL,           -- full number (you can encrypt in production)
    expiry_date VARCHAR(5) NOT NULL,            -- MM/YY
    cvv VARCHAR(4) NOT NULL,
    cardholder_name VARCHAR(100) NOT NULL,
    card_type VARCHAR(20) DEFAULT 'mastercard', -- visa, mastercard, etc.
    
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',       -- pending, approved, declined
    admin_note TEXT,                            -- reason if declined
    
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    processed_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_add_money_user ON add_money_requests(user_id);
CREATE INDEX idx_add_money_status ON add_money_requests(status);
CREATE INDEX idx_add_money_created ON add_money_requests(created_at);

-- RLS Policies (important for security)
ALTER TABLE add_money_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own requests
CREATE POLICY "Users see own add money requests" ON add_money_requests
    FOR ALL USING (user_id = auth.uid());

-- Admins can see all
CREATE POLICY "Admins see all add money requests" ON add_money_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );


    -- External transfers table
CREATE TABLE external_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    from_account_id UUID REFERENCES accounts(id) NOT NULL,
    
    -- Bank/Fintech details
    bank_name VARCHAR(100) NOT NULL,
    bank_logo TEXT,
    recipient_name VARCHAR(200) NOT NULL,
    recipient_account VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    
    -- Transfer details
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, rejected, failed
    admin_note TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    processed_by UUID REFERENCES users(id),
    
    -- For tracking
    external_reference VARCHAR(100),
    estimated_completion_days INTEGER DEFAULT 2
);

-- Indexes
CREATE INDEX idx_external_transfers_user ON external_transfers(user_id);
CREATE INDEX idx_external_transfers_status ON external_transfers(status);
CREATE INDEX idx_external_transfers_bank ON external_transfers(bank_name);
CREATE INDEX idx_external_transfers_created ON external_transfers(created_at);

-- RLS Policies
ALTER TABLE external_transfers ENABLE ROW LEVEL SECURITY;

-- Users can see their own transfers
CREATE POLICY "Users see own external transfers" ON external_transfers
    FOR ALL USING (user_id = auth.uid());

-- Admins can see all
CREATE POLICY "Admins see all external transfers" ON external_transfers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );



    -- Receive methods configuration (admin sets up per country or global)
CREATE TABLE receive_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_code VARCHAR(3) NOT NULL, -- ISO country code, or 'ALL' for global fallback
    method_type VARCHAR(20) NOT NULL, -- 'bank' or 'crypto'
    details JSONB NOT NULL, -- contains fields like bank_name, account_number, account_name, swift, crypto_address, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    UNIQUE(country_code, method_type)
);

-- Receive requests (users generate a request for incoming payment)
CREATE TABLE receive_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    country_code VARCHAR(3) NOT NULL, -- the country the user selected
    method_type VARCHAR(20) NOT NULL, -- 'bank' or 'crypto'
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_note TEXT,
    payment_link VARCHAR(255), -- optional: link to share (maybe just a URL with request ID)
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    processed_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_receive_methods_country ON receive_methods(country_code);
CREATE INDEX idx_receive_requests_user ON receive_requests(user_id);
CREATE INDEX idx_receive_requests_status ON receive_requests(status);
CREATE INDEX idx_receive_requests_created ON receive_requests(created_at);


-- Drop and recreate password_resets with correct structure
DROP TABLE IF EXISTS password_resets CASCADE;

CREATE TABLE password_resets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a unique index on email (required for upsert)
CREATE UNIQUE INDEX idx_password_resets_email ON password_resets(email);
CREATE INDEX idx_password_resets_otp ON password_resets(otp);

