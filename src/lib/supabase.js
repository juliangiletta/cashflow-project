// src/lib/supabase.js
// FIXED v5 - Better debt and card expense handling

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================
// WALLETS
// ============================================
export async function getWallets() {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .order('currency')
    .order('name')
  if (error) { console.error('Error getWallets:', error); return [] }
  return data || []
}

export async function updateWalletBalance(walletId, amount, operation = 'add') {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('id', walletId)
    .single()
  
  if (!wallet) return 0
  
  const newBalance = operation === 'add' 
    ? (parseFloat(wallet.balance) || 0) + parseFloat(amount)
    : (parseFloat(wallet.balance) || 0) - parseFloat(amount)
  
  await supabase.from('wallets').update({ balance: newBalance }).eq('id', walletId)
  return newBalance
}

// ============================================
// CATEGORIES
// ============================================
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) { console.error('Error getCategories:', error); return [] }
  return data || []
}

// ============================================
// TRANSACTIONS
// ============================================
export async function getTransactions(filters = {}) {
  let query = supabase
    .from('transactions')
    .select('*, wallet:wallets(*), category:categories(*)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  
  if (filters.month) {
    const [year, month] = filters.month.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]
    query = query.gte('date', startDate).lte('date', endDate)
  }
  
  // Filtro por tipo - manejar "traspaso" como ambos tipos
  if (filters.type && filters.type !== 'all') {
    if (filters.type === 'traspaso') {
      query = query.in('type', ['traspaso_in', 'traspaso_out'])
    } else {
      query = query.eq('type', filters.type)
    }
  }
  
  if (filters.currency && filters.currency !== 'all') query = query.eq('currency', filters.currency)
  if (filters.walletId && filters.walletId !== 'all') query = query.eq('wallet_id', filters.walletId)
  if (filters.categoryId && filters.categoryId !== 'all') query = query.eq('category_id', filters.categoryId)
  
  const { data, error } = await query
  if (error) { console.error('Error getTransactions:', error); return [] }
  return data || []
}

export async function createTransaction(tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([{
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      wallet_id: tx.wallet_id,
      category_id: tx.category_id || null
    }])
    .select()
    .single()
  
  if (error) throw error
  
  // Determinar si suma o resta del balance
  // ingreso y traspaso_in suman, egreso y traspaso_out restan
  const operation = (tx.type === 'ingreso' || tx.type === 'traspaso_in') ? 'add' : 'subtract'
  await updateWalletBalance(tx.wallet_id, tx.amount, operation)
  return data
}

export async function getMonthlySummary(month) {
  const [year, m] = month.split('-')
  const startDate = `${year}-${m}-01`
  const endDate = new Date(year, m, 0).toISOString().split('T')[0]
  
  const { data } = await supabase
    .from('transactions')
    .select('type, currency, amount')
    .gte('date', startDate)
    .lte('date', endDate)
  
  const summary = { income_ars: 0, expenses_ars: 0, income_usd: 0, expenses_usd: 0 }
  data?.forEach(tx => {
    const amount = parseFloat(tx.amount) || 0
    
    // Excluir traspasos del resumen
    if (tx.type === 'traspaso_in' || tx.type === 'traspaso_out') {
      return
    }
    
    if (tx.type === 'ingreso') {
      if (tx.currency === 'USD') summary.income_usd += amount
      else summary.income_ars += amount
    } else if (tx.type === 'egreso') {
      if (tx.currency === 'USD') summary.expenses_usd += amount
      else summary.expenses_ars += amount
    }
  })
  return summary
}

// ============================================
// CREDIT CARDS
// ============================================
export async function getCreditCards() {
  const { data, error } = await supabase.from('credit_cards').select('*').order('name')
  if (error) { console.error('Error getCreditCards:', error); return [] }
  return data || []
}

export function calculateInstallmentStatementMonth(purchaseDate, closingDay, installmentNumber) {
  const purchase = new Date(purchaseDate + 'T12:00:00') // Evitar problemas de timezone
  const purchaseDay = purchase.getDate()
  
  let year = purchase.getFullYear()
  let month = purchase.getMonth()
  
  // Si la compra es después del cierre, impacta en el mes siguiente
  if (purchaseDay > closingDay) {
    month += 1
  }
  
  // Agregar meses según número de cuota
  month += (installmentNumber - 1)
  
  // Normalizar año/mes
  while (month > 11) {
    month -= 12
    year += 1
  }
  
  const result = `${year}-${String(month + 1).padStart(2, '0')}`
  console.log(`Cuota ${installmentNumber}: fecha compra ${purchaseDate}, cierre ${closingDay}, impacta en ${result}`)
  return result
}

export async function createCreditCardExpense(expense) {
  console.log('Creating credit card expense:', expense)
  
  // Obtener la tarjeta
  const { data: card, error: cardError } = await supabase
    .from('credit_cards')
    .select('closing_day')
    .eq('id', expense.card_id)
    .single()
  
  if (cardError) {
    console.error('Error getting card:', cardError)
    throw cardError
  }
  
  // Crear el gasto principal
  const expenseData = {
    card_id: expense.card_id,
    purchase_date: expense.purchase_date,
    description: expense.description,
    total_amount: parseFloat(expense.total_amount),
    currency: expense.currency,
    installments: parseInt(expense.installments),
    is_own_expense: expense.is_own_expense === true,
    borrower_name: expense.is_own_expense ? null : (expense.borrower_name || null)
  }
  
  console.log('Inserting expense:', expenseData)
  
  const { data: createdExpense, error: expenseError } = await supabase
    .from('credit_card_expenses')
    .insert([expenseData])
    .select()
    .single()
  
  if (expenseError) {
    console.error('Error creating expense:', expenseError)
    throw expenseError
  }
  
  console.log('Created expense:', createdExpense)
  
  // Crear las cuotas
  const installmentAmount = parseFloat(expense.total_amount) / parseInt(expense.installments)
  const installmentsToInsert = []
  
  for (let i = 1; i <= parseInt(expense.installments); i++) {
    const statementMonth = calculateInstallmentStatementMonth(
      expense.purchase_date, 
      card.closing_day, 
      i
    )
    
    installmentsToInsert.push({
      expense_id: createdExpense.id,
      installment_number: i,
      installment_amount: installmentAmount,
      statement_month: statementMonth,
      is_paid: false
    })
  }
  
  console.log('Inserting installments:', installmentsToInsert)
  
  const { error: installmentsError } = await supabase
    .from('credit_card_installments')
    .insert(installmentsToInsert)
  
  if (installmentsError) {
    console.error('Error creating installments:', installmentsError)
    throw installmentsError
  }
  
  return createdExpense
}

export async function getInstallmentsByStatementMonth(month) {
  console.log('Getting installments for month:', month)
  
  const { data, error } = await supabase
    .from('credit_card_installments')
    .select(`
      *,
      expense:credit_card_expenses(
        id, description, purchase_date, total_amount, currency, 
        installments, is_own_expense, borrower_name, card_id
      )
    `)
    .eq('statement_month', month)
    .order('expense_id')
  
  if (error) { 
    console.error('Error getInstallmentsByStatementMonth:', error)
    return [] 
  }
  
  console.log('Raw installments data:', data)
  
  const result = data?.map(inst => ({
    id: inst.id,
    expense_id: inst.expense_id,
    installment_number: inst.installment_number,
    installment_amount: inst.installment_amount,
    statement_month: inst.statement_month,
    is_paid: inst.is_paid,
    paid_date: inst.paid_date,
    card_id: inst.expense?.card_id,
    description: inst.expense?.description,
    purchase_date: inst.expense?.purchase_date,
    total_amount: inst.expense?.total_amount,
    currency: inst.expense?.currency,
    total_installments: inst.expense?.installments,
    is_own_expense: inst.expense?.is_own_expense,
    borrower_name: inst.expense?.borrower_name
  })) || []
  
  console.log('Processed installments:', result)
  return result
}

// ============================================
// DEUDAS - FIXED
// ============================================
export async function getDebtsByPerson() {
  console.log('Loading debts...')
  
  // Obtener TODAS las cuotas con sus gastos
  const { data: allInstallments, error: instError } = await supabase
    .from('credit_card_installments')
    .select(`
      *,
      expense:credit_card_expenses(
        id, description, purchase_date, total_amount, currency,
        installments, is_own_expense, borrower_name, card_id,
        card:credit_cards(id, name, icon)
      )
    `)
    .order('statement_month')
  
  if (instError) {
    console.error('Error loading installments:', instError)
  }
  
  console.log('All installments:', allInstallments)
  
  // Filtrar solo los que NO son gastos propios (es decir, deudas de otros)
  const cardDebts = allInstallments?.filter(inst => {
    const isDebt = inst.expense && inst.expense.is_own_expense === false
    console.log(`Installment ${inst.id}: is_own_expense=${inst.expense?.is_own_expense}, isDebt=${isDebt}`)
    return isDebt
  }) || []
  
  console.log('Card debts (filtered):', cardDebts)
  
  // Obtener deudas manuales
  let manualDebts = []
  try {
    const { data, error } = await supabase
      .from('manual_debts')
      .select('*')
      .order('date', { ascending: false })
    
    if (!error && data) {
      manualDebts = data
      console.log('Manual debts:', manualDebts)
    }
  } catch (e) {
    console.log('manual_debts table may not exist:', e)
  }
  
  // Agrupar por persona
  const debtsByPerson = {}
  
  // Procesar deudas de tarjeta
  cardDebts.forEach(inst => {
    const name = inst.expense.borrower_name
    if (!name) {
      console.log('Skipping installment without borrower_name:', inst)
      return
    }
    
    if (!debtsByPerson[name]) {
      debtsByPerson[name] = {
        name,
        installments: [],
        manualDebts: [],
        total_pending_ars: 0,
        total_pending_usd: 0,
        total_paid_ars: 0,
        total_paid_usd: 0
      }
    }
    
    debtsByPerson[name].installments.push({
      id: inst.id,
      expense_id: inst.expense_id,
      installment_number: inst.installment_number,
      installment_amount: inst.installment_amount,
      statement_month: inst.statement_month,
      is_paid: inst.is_paid,
      paid_date: inst.paid_date,
      description: inst.expense.description,
      currency: inst.expense.currency,
      total_installments: inst.expense.installments,
      card: inst.expense.card
    })
    
    const amount = parseFloat(inst.installment_amount) || 0
    if (inst.is_paid) {
      if (inst.expense.currency === 'USD') debtsByPerson[name].total_paid_usd += amount
      else debtsByPerson[name].total_paid_ars += amount
    } else {
      if (inst.expense.currency === 'USD') debtsByPerson[name].total_pending_usd += amount
      else debtsByPerson[name].total_pending_ars += amount
    }
  })
  
  // Procesar deudas manuales
  manualDebts.forEach(debt => {
    const name = debt.debtor_name
    if (!debtsByPerson[name]) {
      debtsByPerson[name] = {
        name,
        installments: [],
        manualDebts: [],
        total_pending_ars: 0,
        total_pending_usd: 0,
        total_paid_ars: 0,
        total_paid_usd: 0
      }
    }
    
    debtsByPerson[name].manualDebts.push(debt)
    
    const amount = parseFloat(debt.amount) || 0
    if (debt.is_paid) {
      if (debt.currency === 'USD') debtsByPerson[name].total_paid_usd += amount
      else debtsByPerson[name].total_paid_ars += amount
    } else {
      if (debt.currency === 'USD') debtsByPerson[name].total_pending_usd += amount
      else debtsByPerson[name].total_pending_ars += amount
    }
  })
  
  const result = Object.values(debtsByPerson)
    .sort((a, b) => (b.total_pending_ars + b.total_pending_usd) - (a.total_pending_ars + a.total_pending_usd))
  
  console.log('Final debts by person:', result)
  return result
}

export async function markInstallmentPaid(expenseId, installmentNumber, walletId = null) {
  const today = new Date().toISOString().split('T')[0]
  
  console.log('Marking installment as paid:', { expenseId, installmentNumber, walletId })
  
  // Obtener datos de la cuota ANTES de actualizar
  const { data: inst, error: fetchError } = await supabase
    .from('credit_card_installments')
    .select(`
      *,
      expense:credit_card_expenses(description, currency, borrower_name)
    `)
    .eq('expense_id', expenseId)
    .eq('installment_number', installmentNumber)
    .single()
  
  if (fetchError) {
    console.error('Error fetching installment:', fetchError)
    throw fetchError
  }
  
  console.log('Installment to mark as paid:', inst)
  
  // Marcar como pagada
  const { error: updateError } = await supabase
    .from('credit_card_installments')
    .update({ is_paid: true, paid_date: today })
    .eq('expense_id', expenseId)
    .eq('installment_number', installmentNumber)
  
  if (updateError) {
    console.error('Error updating installment:', updateError)
    throw updateError
  }
  
  // Si hay walletId, crear ingreso automático
  if (walletId && inst) {
    console.log('Creating income transaction...')
    await createTransaction({
      date: today,
      description: `Pago deuda: ${inst.expense.borrower_name} - ${inst.expense.description}`,
      amount: inst.installment_amount,
      currency: inst.expense.currency,
      type: 'ingreso',
      wallet_id: walletId
    })
  }
  
  return true
}

// ============================================
// DEUDAS MANUALES
// ============================================
export async function createManualDebt(debt) {
  console.log('Creating manual debt:', debt)
  
  const { data, error } = await supabase
    .from('manual_debts')
    .insert([{
      debtor_name: debt.debtor_name,
      description: debt.description,
      amount: parseFloat(debt.amount),
      currency: debt.currency || 'ARS',
      date: debt.date || new Date().toISOString().split('T')[0],
      notes: debt.notes || null,
      is_paid: false
    }])
    .select()
    .single()
  
  if (error) {
    console.error('Error creating manual debt:', error)
    throw error
  }
  
  console.log('Created manual debt:', data)
  return data
}

export async function markManualDebtPaid(debtId, walletId = null) {
  const today = new Date().toISOString().split('T')[0]
  
  console.log('Marking manual debt as paid:', { debtId, walletId })
  
  // Obtener datos de la deuda ANTES de actualizar
  const { data: debt, error: fetchError } = await supabase
    .from('manual_debts')
    .select('*')
    .eq('id', debtId)
    .single()
  
  if (fetchError) {
    console.error('Error fetching debt:', fetchError)
    throw fetchError
  }
  
  console.log('Debt to mark as paid:', debt)
  
  // Marcar como pagada
  const { error: updateError } = await supabase
    .from('manual_debts')
    .update({ is_paid: true, paid_date: today, paid_to_wallet_id: walletId })
    .eq('id', debtId)
  
  if (updateError) {
    console.error('Error updating debt:', updateError)
    throw updateError
  }
  
  // Si hay walletId, crear ingreso automático
  if (walletId && debt) {
    console.log('Creating income transaction...')
    await createTransaction({
      date: today,
      description: `Pago deuda: ${debt.debtor_name} - ${debt.description}`,
      amount: debt.amount,
      currency: debt.currency,
      type: 'ingreso',
      wallet_id: walletId
    })
  }
  
  return true
}

// ============================================
// MEDICAL RECORDS
// ============================================
export async function getMedicalRecords() {
  const { data, error } = await supabase
    .from('medical_records')
    .select('*')
    .order('date', { ascending: false })
  if (error) { console.error('Error getMedicalRecords:', error); return [] }
  return data || []
}

// ============================================
// APARTMENT
// ============================================
export async function getApartmentConfig() {
  const { data, error } = await supabase.from('apartment_config').select('*').order('person_name')
  if (error) { console.error('Error getApartmentConfig:', error); return [] }
  return data || []
}

export async function getApartmentSalaries(month) {
  // month viene como "2025-12", convertir a fecha "2025-12-01"
  const monthDate = `${month}-01`
  
  const { data, error } = await supabase
    .from('apartment_salaries')
    .select('*')
    .eq('month', monthDate)
  if (error) { console.error('Error getApartmentSalaries:', error); return [] }
  return data || []
}

export async function setApartmentSalary(month, personName, salary) {
  // month viene como "2025-12", convertir a fecha "2025-12-01"
  const monthDate = `${month}-01`
  
  const { data: existing } = await supabase
    .from('apartment_salaries')
    .select('id')
    .eq('person_name', personName)
    .eq('month', monthDate)
    .maybeSingle()
  
  if (existing) {
    const { error } = await supabase.from('apartment_salaries').update({ salary }).eq('id', existing.id)
    if (error) console.error('Error updating salary:', error)
  } else {
    const { error } = await supabase.from('apartment_salaries').insert([{ 
      month: monthDate, 
      person_name: personName, 
      salary 
    }])
    if (error) console.error('Error inserting salary:', error)
  }
}

export async function getApartmentExpenses(month) {
  // month viene como "2025-12", convertir a fecha "2025-12-01"
  const monthDate = `${month}-01`
  
  const { data, error } = await supabase
    .from('apartment_expenses')
    .select('*')
    .eq('month', monthDate)
    .order('created_at', { ascending: false })
  if (error) { console.error('Error getApartmentExpenses:', error); return [] }
  return data || []
}

export async function createApartmentExpense(expense) {
  // Convertir month "2025-12" a fecha "2025-12-01" si es necesario
  let monthValue = expense.month
  if (monthValue && monthValue.length === 7) {
    monthValue = `${monthValue}-01`
  }
  
  const { data, error } = await supabase
    .from('apartment_expenses')
    .insert([{ 
      month: monthValue, 
      description: expense.description, 
      amount: parseFloat(expense.amount), 
      category: expense.category, 
      paid_by: expense.paid_by,
      is_payment: expense.is_payment || false
    }])
    .select()
    .single()
  if (error) {
    console.error('Error createApartmentExpense:', error)
    throw error
  }
  return data
}

// ============================================
// SALARY
// ============================================
export async function getSalaryHistory() {
  const { data, error } = await supabase.from('salary_history').select('*').order('month', { ascending: false })
  if (error) { console.error('Error getSalaryHistory:', error); return [] }
  return data || []
}

export async function addSalaryRecord(record) {
  const monthDate = record.month + '-01'
  const { data: existing } = await supabase
    .from('salary_history')
    .select('id')
    .eq('month', monthDate)
    .single()
  
  const salaryData = {
    month: monthDate,
    net_salary: parseFloat(record.net_salary) || 0,
    gross_salary: parseFloat(record.gross_salary) || null,
    bonus: parseFloat(record.bonus) || null
  }
  
  if (existing) {
    await supabase.from('salary_history').update(salaryData).eq('id', existing.id)
  } else {
    await supabase.from('salary_history').insert([salaryData])
  }
}

// ============================================
// INVESTMENTS
// ============================================
export async function getInvestments() {
  const { data, error } = await supabase.from('investments').select('*').order('platform').order('asset_symbol')
  if (error) { console.error('Error getInvestments:', error); return [] }
  return data || []
}

export async function addInvestmentTransaction(tx) {
  console.log('Investment transaction:', tx)
  
  const { data: existing, error: fetchError } = await supabase
    .from('investments')
    .select('*')
    .eq('platform', tx.platform)
    .eq('asset_symbol', tx.asset_symbol.toUpperCase())
    .maybeSingle()
  
  if (fetchError) {
    console.error('Error fetching existing investment:', fetchError)
  }
  
  console.log('Existing investment:', existing)
  
  const quantity = parseFloat(tx.quantity) || 0
  const price = parseFloat(tx.price) || 0
  const total = quantity * price
  
  if (existing) {
    let newQuantity, newTotal, newAvgPrice
    
    if (tx.type === 'compra') {
      newQuantity = parseFloat(existing.quantity) + quantity
      newTotal = parseFloat(existing.total_invested) + total
      newAvgPrice = newTotal / newQuantity
    } else {
      // VENTA
      newQuantity = parseFloat(existing.quantity) - quantity
      
      if (newQuantity < 0) {
        throw new Error(`No podés vender más de lo que tenés (${existing.quantity} unidades)`)
      }
      
      // Mantener el avg_price original, solo reducir la cantidad y el total proporcional
      const ratio = newQuantity / parseFloat(existing.quantity)
      newTotal = parseFloat(existing.total_invested) * ratio
      newAvgPrice = existing.avg_price // Mantener precio promedio original
    }
    
    console.log('New values:', { newQuantity, newTotal, newAvgPrice })
    
    if (newQuantity <= 0.0001) { // Usar tolerancia por decimales
      console.log('Deleting investment (quantity <= 0)')
      const { error: deleteError } = await supabase.from('investments').delete().eq('id', existing.id)
      if (deleteError) {
        console.error('Error deleting investment:', deleteError)
        throw deleteError
      }
    } else {
      console.log('Updating investment')
      const { error: updateError } = await supabase.from('investments').update({
        quantity: newQuantity,
        total_invested: newTotal,
        avg_price: newAvgPrice
      }).eq('id', existing.id)
      
      if (updateError) {
        console.error('Error updating investment:', updateError)
        throw updateError
      }
    }
  } else if (tx.type === 'compra') {
    console.log('Creating new investment')
    const { error: insertError } = await supabase.from('investments').insert([{
      platform: tx.platform,
      asset_symbol: tx.asset_symbol.toUpperCase(),
      quantity,
      avg_price: price,
      total_invested: total,
      currency: tx.currency
    }])
    
    if (insertError) {
      console.error('Error inserting investment:', insertError)
      throw insertError
    }
  } else {
    throw new Error(`No tenés ${tx.asset_symbol} para vender`)
  }
}

export async function deleteInvestment(id) {
  const { error } = await supabase.from('investments').delete().eq('id', id)
  if (error) {
    console.error('Error deleting investment:', error)
    throw error
  }
}


// ============================================
// FIXED EXPENSES (Gastos Fijos)
// ============================================
export async function getFixedExpenses() {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) { console.error('Error getFixedExpenses:', error); return [] }
  return data || []
}

export async function createFixedExpense(expense) {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .insert([{
      name: expense.name,
      amount: parseFloat(expense.amount) || 0,
      currency: expense.currency || 'ARS',
      icon: expense.icon || '📌',
      sort_order: expense.sort_order || 99
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFixedExpense(id, updates) {
  const { error } = await supabase
    .from('fixed_expenses')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteFixedExpense(id) {
  const { error } = await supabase
    .from('fixed_expenses')
    .delete()
    .eq('id', id)
  if (error) throw error
}