-- =============================================
-- CASHFLOW DATABASE SCHEMA FOR SUPABASE
-- =============================================
-- Ejecutar este script en el SQL Editor de Supabase
-- (Dashboard > SQL Editor > New Query > Pegar > Run)

-- ---------------------------------------------
-- TABLA: wallets (billeteras/cuentas)
-- ---------------------------------------------
CREATE TABLE wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'efectivo', 'banco', 'billetera_virtual', 'broker'
    icon VARCHAR(10) DEFAULT '💰',
    balance DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'ARS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: categories (categorías de gastos)
-- ---------------------------------------------
CREATE TABLE categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'ingreso', 'egreso', 'inversion'
    icon VARCHAR(10) DEFAULT '📁',
    color VARCHAR(7) DEFAULT '#6b7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: transactions (movimientos)
-- ---------------------------------------------
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'ingreso', 'egreso', 'inversion'
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    payment_method VARCHAR(50), -- 'debito', 'credito', 'efectivo', 'transferencia'
    -- Campos específicos para inversiones
    asset_symbol VARCHAR(20),
    asset_quantity DECIMAL(15,8),
    asset_price DECIMAL(15,4),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: assets (activos de inversión)
-- ---------------------------------------------
CREATE TABLE assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100),
    type VARCHAR(50) NOT NULL, -- 'accion_arg', 'accion_usa', 'crypto', 'bono', 'fci'
    currency VARCHAR(3) DEFAULT 'ARS',
    current_price DECIMAL(15,4),
    last_updated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: holdings (tenencias actuales)
-- ---------------------------------------------
CREATE TABLE holdings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    quantity DECIMAL(15,8) NOT NULL DEFAULT 0,
    avg_price DECIMAL(15,4) NOT NULL DEFAULT 0,
    total_invested DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asset_id)
);

-- ---------------------------------------------
-- TABLA: medical_records (controles médicos)
-- ---------------------------------------------
CREATE TABLE medical_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    comments TEXT,
    weight DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'completed', -- 'completed', 'pending'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: medical_files (archivos médicos)
-- ---------------------------------------------
CREATE TABLE medical_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    medical_record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: apartment_expenses (gastos departamento)
-- ---------------------------------------------
CREATE TABLE apartment_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month DATE NOT NULL, -- primer día del mes
    detail VARCHAR(100) NOT NULL, -- 'alquiler', 'expensas', 'internet', 'luz', 'gas'
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: apartment_config (configuración depto)
-- ---------------------------------------------
CREATE TABLE apartment_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    person_name VARCHAR(100) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: salary_history (historial de sueldo)
-- ---------------------------------------------
CREATE TABLE salary_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month DATE NOT NULL,
    salary_ars DECIMAL(15,2),
    salary_usd DECIMAL(15,2),
    dollar_rate DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: vacations (viajes/vacaciones)
-- ---------------------------------------------
CREATE TABLE vacations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    total_budget DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: vacation_expenses (gastos de vacaciones)
-- ---------------------------------------------
CREATE TABLE vacation_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vacation_id UUID REFERENCES vacations(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    category VARCHAR(50), -- 'pasajes', 'alojamiento', 'comida', 'actividades', 'otros'
    is_reserved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- TABLA: credit_card_loans (préstamos de tarjeta)
-- ---------------------------------------------
CREATE TABLE credit_card_loans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    person_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    amount DECIMAL(15,2) NOT NULL,
    card VARCHAR(50), -- nombre de la tarjeta
    date DATE NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Billeteras
INSERT INTO wallets (name, type, icon, currency) VALUES
('Efectivo', 'efectivo', '💵', 'ARS'),
('Mercado Pago', 'billetera_virtual', '🔵', 'ARS'),
('Santander', 'banco', '🔴', 'ARS'),
('Ualá', 'billetera_virtual', '🟣', 'ARS'),
('Naranja X', 'billetera_virtual', '🟠', 'ARS'),
('IOL', 'broker', '📈', 'ARS');

-- Categorías
INSERT INTO categories (name, type, icon, color) VALUES
('Alimentación', 'egreso', '🍔', '#ef4444'),
('Vivienda', 'egreso', '🏠', '#f97316'),
('Servicios', 'egreso', '📱', '#eab308'),
('Transporte', 'egreso', '🚗', '#22c55e'),
('Entretenimiento', 'egreso', '🎬', '#3b82f6'),
('Salud', 'egreso', '💊', '#ec4899'),
('Ropa', 'egreso', '👕', '#8b5cf6'),
('Otros', 'egreso', '📦', '#6b7280'),
('Sueldo', 'ingreso', '💰', '#10b981'),
('Freelance', 'ingreso', '💻', '#06b6d4'),
('Inversiones', 'ingreso', '📈', '#3b82f6'),
('Otros Ingresos', 'ingreso', '💵', '#84cc16'),
('Acciones ARG', 'inversion', '🇦🇷', '#3b82f6'),
('Acciones USA', 'inversion', '🇺🇸', '#10b981'),
('Crypto', 'inversion', '₿', '#f59e0b'),
('Bonos', 'inversion', '📄', '#8b5cf6'),
('FCI', 'inversion', '🏦', '#06b6d4');

-- Configuración departamento
INSERT INTO apartment_config (person_name, percentage) VALUES
('Julian', 68.81),
('Brenda', 31.19);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================

-- Función para actualizar el timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apartment_expenses_updated_at BEFORE UPDATE ON apartment_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCIÓN: Calcular precio promedio al comprar
-- =============================================
CREATE OR REPLACE FUNCTION update_holding_on_buy()
RETURNS TRIGGER AS $$
DECLARE
    v_asset_id UUID;
    v_current_qty DECIMAL(15,8);
    v_current_avg DECIMAL(15,4);
    v_new_qty DECIMAL(15,8);
    v_new_avg DECIMAL(15,4);
    v_new_invested DECIMAL(15,2);
BEGIN
    -- Solo procesar si es una inversión con símbolo de activo
    IF NEW.type = 'inversion' AND NEW.asset_symbol IS NOT NULL THEN
        -- Buscar o crear el activo
        SELECT id INTO v_asset_id FROM assets WHERE symbol = NEW.asset_symbol;
        
        IF v_asset_id IS NULL THEN
            INSERT INTO assets (symbol, type, currency)
            VALUES (NEW.asset_symbol, 'accion_arg', 'ARS')
            RETURNING id INTO v_asset_id;
        END IF;
        
        -- Buscar holding existente
        SELECT quantity, avg_price INTO v_current_qty, v_current_avg
        FROM holdings WHERE asset_id = v_asset_id;
        
        IF v_current_qty IS NULL THEN
            -- Crear nuevo holding
            INSERT INTO holdings (asset_id, quantity, avg_price, total_invested)
            VALUES (v_asset_id, NEW.asset_quantity, NEW.asset_price, NEW.amount);
        ELSE
            -- Calcular nuevo promedio ponderado
            v_new_qty := v_current_qty + NEW.asset_quantity;
            v_new_avg := ((v_current_qty * v_current_avg) + (NEW.asset_quantity * NEW.asset_price)) / v_new_qty;
            v_new_invested := v_new_qty * v_new_avg;
            
            UPDATE holdings
            SET quantity = v_new_qty,
                avg_price = v_new_avg,
                total_invested = v_new_invested
            WHERE asset_id = v_asset_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_holding_on_buy
    AFTER INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_holding_on_buy();

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista: Resumen mensual
CREATE OR REPLACE VIEW monthly_summary AS
SELECT 
    DATE_TRUNC('month', date) as month,
    SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END) as total_expenses,
    SUM(CASE WHEN type = 'inversion' THEN amount ELSE 0 END) as total_invested,
    SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END) - 
    SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END) as balance
FROM transactions
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;

-- Vista: Portfolio actual
CREATE OR REPLACE VIEW portfolio_view AS
SELECT 
    a.symbol,
    a.name,
    a.type,
    a.currency,
    a.current_price,
    h.quantity,
    h.avg_price,
    h.total_invested,
    (h.quantity * COALESCE(a.current_price, h.avg_price)) as current_value,
    CASE 
        WHEN h.avg_price > 0 THEN 
            ((COALESCE(a.current_price, h.avg_price) - h.avg_price) / h.avg_price * 100)
        ELSE 0 
    END as return_percentage
FROM holdings h
JOIN assets a ON h.asset_id = a.id
WHERE h.quantity > 0
ORDER BY current_value DESC;

-- Vista: Gastos por categoría del mes actual
CREATE OR REPLACE VIEW current_month_by_category AS
SELECT 
    c.name as category,
    c.icon,
    c.color,
    SUM(t.amount) as total
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.type = 'egreso'
    AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY c.name, c.icon, c.color
ORDER BY total DESC;

-- =============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =============================================
-- Por ahora deshabilitamos RLS para simplificar
-- Si después querés multi-usuario, lo habilitamos

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_loans ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (para desarrollo sin auth)
CREATE POLICY "Allow all for wallets" ON wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for assets" ON assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for holdings" ON holdings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for medical_records" ON medical_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for medical_files" ON medical_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for apartment_expenses" ON apartment_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for apartment_config" ON apartment_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for salary_history" ON salary_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for vacations" ON vacations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for vacation_expenses" ON vacation_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for credit_card_loans" ON credit_card_loans FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- STORAGE BUCKET PARA ARCHIVOS MÉDICOS
-- =============================================
-- Esto se hace desde el Dashboard de Supabase:
-- 1. Ir a Storage
-- 2. Create new bucket: "medical-files"
-- 3. Hacerlo público o configurar políticas según necesites
