import React, { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { 
  Home, CreditCard, Users, Building2, Wallet, TrendingUp, Stethoscope, 
  Plus, ArrowUpRight, ArrowDownRight, Filter, ArrowRightLeft,
  Calendar, DollarSign, PiggyBank, MoreHorizontal, Check, RefreshCw, Loader2, Trash2
} from 'lucide-react'
import * as db from './lib/supabase'
import * as market from './lib/marketData'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// Utilities
const formatCurrency = (amount, currency = 'ARS') => {
  const num = parseFloat(amount) || 0
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currency === 'USD' ? 'USD' : 'ARS' }).format(num)
}
const formatDate = (dateStr) => { try { return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: es }) } catch { return dateStr || '' } }
const formatMonth = (monthStr) => { try { const [y, m] = monthStr.split('-'); return format(new Date(+y, +m - 1, 1), 'MMMM yyyy', { locale: es }) } catch { return monthStr || '' } }
const getCurrentMonth = () => format(new Date(), 'yyyy-MM')
const getMonthOptions = (f = 12, p = 12) => { const opts = [], now = new Date(); for (let i = -f; i <= p; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); opts.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: es }) }) } return opts }

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
        <p className="font-medium text-sm">{data.name}</p>
        <p className="text-primary font-bold">${data.value?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        <p className="text-xs text-muted-foreground">{data.percentage}%</p>
      </div>
    )
  }
  return null
}

const StatCard = ({ title, value, subtitle, icon: Icon, variant = 'default' }) => {
  const v = { 
    default: 'bg-card border border-border', 
    primary: 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0', 
    success: 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0', 
    danger: 'bg-gradient-to-br from-red-600 to-red-700 text-white border-0', 
    purple: 'bg-gradient-to-br from-purple-600 to-purple-700 text-white border-0' 
  }
  return (
    <Card className={cn(v[variant], 'shadow-lg')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={cn('text-xs font-medium', variant === 'default' ? 'text-muted-foreground' : 'text-white/80')}>{title}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
            {subtitle && <p className={cn('text-xs mt-0.5', variant === 'default' ? 'text-muted-foreground' : 'text-white/70')}>{subtitle}</p>}
          </div>
          {Icon && <div className={cn('p-2 rounded-full', variant === 'default' ? 'bg-muted' : 'bg-white/20')}><Icon className="h-5 w-5" /></div>}
        </div>
      </CardContent>
    </Card>
  )
}

const TransactionItem = ({ tx }) => {
  const isTransfer = tx.type === 'traspaso_in' || tx.type === 'traspaso_out'
  const isIncome = tx.type === 'ingreso' || tx.type === 'traspaso_in'
  
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-full', 
          isTransfer ? 'bg-blue-500/20 text-blue-400' :
          isIncome ? 'bg-emerald-500/20 text-emerald-400' : 
          'bg-red-500/20 text-red-400'
        )}>
          {isTransfer ? <ArrowRightLeft className="h-4 w-4" /> :
           isIncome ? <ArrowUpRight className="h-4 w-4" /> :
           <ArrowDownRight className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-medium text-sm">{tx.description}</p>
          <p className="text-xs text-muted-foreground">{formatDate(tx.date)} • {tx.wallet?.name}</p>
        </div>
      </div>
      <span className={cn('font-semibold', 
        isTransfer ? 'text-blue-400' :
        isIncome ? 'text-emerald-400' : 
        'text-red-400'
      )}>
        {isIncome && !isTransfer ? '+' : isTransfer ? '' : '-'}{formatCurrency(tx.amount, tx.currency)}
      </span>
    </div>
  )
}

// ============================================
// MODALS - UPDATED
// ============================================
const TransactionModal = ({ open, onOpenChange, onSave, onTransfer, wallets = [], categories = [] }) => {
  const [form, setForm] = useState({ 
    type: 'egreso', 
    date: format(new Date(), 'yyyy-MM-dd'), 
    description: '', 
    amount: '', 
    currency: 'ARS', 
    wallet_id: '', 
    category_id: '',
    // Para traspasos
    from_wallet_id: '',
    to_wallet_id: ''
  })
  
  const filteredWallets = wallets.filter(w => w.currency === form.currency)
  const filteredCategories = categories.filter(c => c.type === form.type)
  const isTransfer = form.type === 'traspaso'
  
  useEffect(() => {
    if (open && wallets.length) {
      const w = wallets.find(w => w.currency === 'ARS')
      setForm(p => ({ 
        ...p, 
        wallet_id: w?.id || wallets[0]?.id || '', 
        from_wallet_id: w?.id || '',
        to_wallet_id: '',
        description: '', 
        amount: '', 
        category_id: '' 
      }))
    }
  }, [open, wallets])
  
  useEffect(() => {
    const w = wallets.find(w => w.currency === form.currency)
    if (w) setForm(p => ({ ...p, wallet_id: w.id, from_wallet_id: w.id }))
  }, [form.currency, wallets])
  
  const h = (f, v) => setForm(p => ({ ...p, [f]: v }))
  
  const handleSave = () => {
    if (!form.description || !form.amount) return alert('Completá descripción y monto')
    
    if (isTransfer) {
      if (!form.from_wallet_id || !form.to_wallet_id) return alert('Seleccioná ambas billeteras')
      if (form.from_wallet_id === form.to_wallet_id) return alert('Las billeteras deben ser diferentes')
      onTransfer({
        date: form.date,
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        from_wallet_id: form.from_wallet_id,
        to_wallet_id: form.to_wallet_id
      })
    } else {
      if (!form.wallet_id) return alert('Seleccioná una billetera')
      onSave({
        ...form,
        amount: parseFloat(form.amount)
      })
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nuevo Movimiento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Tabs value={form.currency} onValueChange={v => h('currency', v)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ARS">🇦🇷 Pesos</TabsTrigger>
              <TabsTrigger value="USD">🇺🇸 Dólares</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Tabs value={form.type} onValueChange={v => h('type', v)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="egreso" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">Egreso</TabsTrigger>
              <TabsTrigger value="ingreso" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Ingreso</TabsTrigger>
              <TabsTrigger value="traspaso" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Traspaso</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Input type="date" value={form.date} onChange={e => h('date', e.target.value)} />
          </div>
          
          <div className="grid gap-2">
            <Label>Descripción</Label>
            <Input placeholder="Ej: Supermercado..." value={form.description} onChange={e => h('description', e.target.value)} />
          </div>
          
          <div className="grid gap-2">
            <Label>Monto ({form.currency})</Label>
            <Input type="number" placeholder="0.00" value={form.amount} onChange={e => h('amount', e.target.value)} />
          </div>
          
          {isTransfer ? (
            <>
              <div className="grid gap-2">
                <Label>De billetera (origen)</Label>
                <Select value={form.from_wallet_id} onValueChange={v => h('from_wallet_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar origen..." /></SelectTrigger>
                  <SelectContent>
                    {filteredWallets.map(w => <SelectItem key={w.id} value={w.id}>{w.icon} {w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>A billetera (destino)</Label>
                <Select value={form.to_wallet_id} onValueChange={v => h('to_wallet_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar destino..." /></SelectTrigger>
                  <SelectContent>
                    {filteredWallets.filter(w => w.id !== form.from_wallet_id).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.icon} {w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>Billetera</Label>
                <Select value={form.wallet_id} onValueChange={v => h('wallet_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar billetera..." /></SelectTrigger>
                  <SelectContent>
                    {filteredWallets.length > 0 ? (
                      filteredWallets.map(w => <SelectItem key={w.id} value={w.id}>{w.icon} {w.name}</SelectItem>)
                    ) : (
                      <SelectItem value="none" disabled>No hay billeteras en {form.currency}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Select value={form.category_id} onValueChange={v => h('category_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)
                    ) : (
                      <SelectItem value="none" disabled>No hay categorías</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const CreditCardModal = ({ open, onOpenChange, onSave, cards = [] }) => {
  const [form, setForm] = useState({ card_id: '', purchase_date: format(new Date(), 'yyyy-MM-dd'), description: '', total_amount: '', currency: 'ARS', installments: '1', is_own_expense: true, borrower_name: '' })
  
  useEffect(() => {
    if (open && cards.length) {
      setForm(p => ({ ...p, card_id: cards[0].id, description: '', total_amount: '', borrower_name: '', is_own_expense: true }))
    }
  }, [open, cards])
  
  const h = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const card = cards.find(c => c.id === form.card_id)
  const impact = form.purchase_date && card ? db.calculateInstallmentStatementMonth(form.purchase_date, card.closing_day, 1) : ''
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Gasto de Tarjeta</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            <div className="grid gap-2">
              <Label>Tarjeta</Label>
              <Select value={form.card_id} onValueChange={v => h('card_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={form.currency} onValueChange={v => h('currency', v)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ARS">🇦🇷 Pesos</TabsTrigger>
                <TabsTrigger value="USD">🇺🇸 Dólares</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid gap-2">
              <Label>Fecha de compra</Label>
              <Input type="date" value={form.purchase_date} onChange={e => h('purchase_date', e.target.value)} />
              {impact && <p className="text-xs text-blue-400 flex items-center gap-1"><Calendar className="h-3 w-3" />Impacta en: <span className="font-medium capitalize">{formatMonth(impact)}</span></p>}
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input placeholder="Ej: Zapatillas..." value={form.description} onChange={e => h('description', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Monto Total</Label>
              <Input type="number" placeholder="0.00" value={form.total_amount} onChange={e => h('total_amount', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Cuotas</Label>
              <Select value={form.installments} onValueChange={v => h('installments', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1,2,3,4,5,6,9,12,18,24].map(n => <SelectItem key={n} value={String(n)}>{n} cuota{n>1?'s':''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Tabs value={form.is_own_expense ? 'mine' : 'debt'} onValueChange={v => h('is_own_expense', v === 'mine')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="mine">✓ Es mío</TabsTrigger>
                <TabsTrigger value="debt">👤 Me deben</TabsTrigger>
              </TabsList>
            </Tabs>
            {!form.is_own_expense && (
              <div className="grid gap-2">
                <Label>¿Quién te debe?</Label>
                <Input placeholder="Nombre de la persona..." value={form.borrower_name} onChange={e => h('borrower_name', e.target.value)} />
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => {
            if (!form.description || !form.total_amount) return alert('Completá los campos')
            if (!form.is_own_expense && !form.borrower_name) return alert('Indicá quién te debe')
            onSave({ ...form, installments: parseInt(form.installments), total_amount: parseFloat(form.total_amount) })
          }}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ManualDebtModal = ({ open, onOpenChange, onSave }) => {
  const [form, setForm] = useState({ debtor_name: '', description: '', amount: '', currency: 'ARS', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  
  useEffect(() => {
    if (open) setForm({ debtor_name: '', description: '', amount: '', currency: 'ARS', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  }, [open])
  
  const h = (f, v) => setForm(p => ({ ...p, [f]: v }))
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>👤 Nueva Deuda Manual</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>¿Quién te debe?</Label>
            <Input placeholder="Nombre de la persona..." value={form.debtor_name} onChange={e => h('debtor_name', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Descripción</Label>
            <Input placeholder="Ej: Almuerzo, taxi, etc..." value={form.description} onChange={e => h('description', e.target.value)} />
          </div>
          <Tabs value={form.currency} onValueChange={v => h('currency', v)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ARS">🇦🇷 Pesos</TabsTrigger>
              <TabsTrigger value="USD">🇺🇸 Dólares</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-2">
            <Label>Monto</Label>
            <Input type="number" placeholder="0.00" value={form.amount} onChange={e => h('amount', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Input type="date" value={form.date} onChange={e => h('date', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => {
            if (!form.debtor_name || !form.description || !form.amount) return alert('Completá todos los campos')
            onSave(form)
          }}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const InvestmentModal = ({ open, onOpenChange, onSave }) => {
  const [form, setForm] = useState({ platform: 'cripto', type: 'compra', asset_symbol: '', quantity: '', price: '', currency: 'USD' })
  useEffect(() => { if (open) setForm({ platform: 'cripto', type: 'compra', asset_symbol: '', quantity: '', price: '', currency: 'USD' }) }, [open])
  useEffect(() => { setForm(p => ({ ...p, currency: p.platform === 'iol' ? 'ARS' : 'USD' })) }, [form.platform])
  const h = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const total = (+form.quantity || 0) * (+form.price || 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Nueva Operación</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Tabs value={form.platform} onValueChange={v => h('platform', v)}><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="cripto">🪙 Crypto</TabsTrigger><TabsTrigger value="iol">🇦🇷 CEDEARs</TabsTrigger><TabsTrigger value="usa">🇺🇸 US</TabsTrigger></TabsList></Tabs>
          <Tabs value={form.type} onValueChange={v => h('type', v)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="compra" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Compra</TabsTrigger><TabsTrigger value="venta" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">Venta</TabsTrigger></TabsList></Tabs>
          <div className="grid gap-2"><Label>Símbolo / Ticker</Label><Input placeholder={form.platform === 'cripto' ? 'BTC, ETH, SOL...' : 'AAPL, GOOGL...'} value={form.asset_symbol} onChange={e => h('asset_symbol', e.target.value.toUpperCase())} /></div>
          <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Cantidad</Label><Input type="number" value={form.quantity} onChange={e => h('quantity', e.target.value)} /></div><div className="grid gap-2"><Label>Precio ({form.currency})</Label><Input type="number" value={form.price} onChange={e => h('price', e.target.value)} /></div></div>
          {total > 0 && <div className="text-center p-4 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{formatCurrency(total, form.currency)}</p></div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="bg-purple-600 hover:bg-purple-700" onClick={() => { if (!form.asset_symbol || !form.quantity || !form.price) return alert('Completá los campos'); onSave({ ...form, total }) }}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// SALARY MODAL - Now creates transaction automatically
const SalaryModal = ({ open, onOpenChange, onSave, wallets = [], categories = [] }) => {
  const [form, setForm] = useState({ month: getCurrentMonth(), net_salary: '', gross_salary: '', bonus: '', wallet_id: '' })
  const arsWallets = wallets.filter(w => w.currency === 'ARS')
  const sueldoCategory = categories.find(c => c.name === 'Sueldo' && c.type === 'ingreso')
  
  useEffect(() => { 
    if (open) {
      const defaultWallet = arsWallets[0]?.id || ''
      setForm({ month: getCurrentMonth(), net_salary: '', gross_salary: '', bonus: '', wallet_id: defaultWallet }) 
    }
  }, [open])
  
  const h = (f, v) => setForm(p => ({ ...p, [f]: v }))
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Registrar Sueldo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Mes</Label>
            <Select value={form.month} onValueChange={v => h('month', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{getMonthOptions(0, 24).map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Sueldo Neto</Label>
            <Input type="number" placeholder="0.00" value={form.net_salary} onChange={e => h('net_salary', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Sueldo Bruto (opcional)</Label>
            <Input type="number" placeholder="0.00" value={form.gross_salary} onChange={e => h('gross_salary', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Bonus (opcional)</Label>
            <Input type="number" placeholder="0.00" value={form.bonus} onChange={e => h('bonus', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>💰 Ingresar en billetera</Label>
            <Select value={form.wallet_id} onValueChange={v => h('wallet_id', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar billetera..." /></SelectTrigger>
              <SelectContent>
                {arsWallets.map(w => <SelectItem key={w.id} value={w.id}>{w.icon} {w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Se creará automáticamente un ingreso con categoría "Sueldo"</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { 
            if (!form.net_salary) return alert('Ingresá el sueldo')
            if (!form.wallet_id) return alert('Seleccioná una billetera')
            onSave({ ...form, category_id: sueldoCategory?.id }) 
          }}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const AptExpenseModal = ({ open, onOpenChange, onSave, categories = [], config = [] }) => {
  const cats = categories.filter(c => c.type === 'depto')
  const [form, setForm] = useState({ description: '', amount: '', category: '', paid_by: '' })
  useEffect(() => { if (open && config.length) setForm({ description: '', amount: '', category: '', paid_by: config[0]?.person_name || '' }) }, [open, config])
  const h = (f, v) => setForm(p => ({ ...p, [f]: v }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Gasto de Depto</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2"><Label>Descripción</Label><Input placeholder="Ej: Alquiler..." value={form.description} onChange={e => h('description', e.target.value)} /></div>
          <div className="grid gap-2"><Label>Monto</Label><Input type="number" placeholder="0.00" value={form.amount} onChange={e => h('amount', e.target.value)} /></div>
          <div className="grid gap-2"><Label>Categoría</Label><Select value={form.category} onValueChange={v => h('category', v)}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label>¿Quién pagó?</Label><Select value={form.paid_by} onValueChange={v => h('paid_by', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{config.map(p => <SelectItem key={p.id} value={p.person_name}>{p.person_name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => { if (!form.description || !form.amount) return alert('Completá los campos'); onSave(form) }}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [wallets, setWallets] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [medicalRecords, setMedicalRecords] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [cardExpenses, setCardExpenses] = useState([])
  const [debts, setDebts] = useState([])
  const [summary, setSummary] = useState({ income_ars: 0, expenses_ars: 0, income_usd: 0, expenses_usd: 0 })
  const [aptConfig, setAptConfig] = useState([])
  const [aptSalaries, setAptSalaries] = useState([])
  const [aptExpenses, setAptExpenses] = useState([])
  const [salaryHistory, setSalaryHistory] = useState([])
  const [investments, setInvestments] = useState([])
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [month, setMonth] = useState(getCurrentMonth())
  const [currency, setCurrency] = useState('ARS')
  const [filters, setFilters] = useState({ type: 'all', currency: 'all', walletId: 'all', categoryId: 'all' })
  const [modals, setModals] = useState({ tx: false, card: false, inv: false, salary: false, apt: false, debt: false, debtDetail: false, more: false })
  const [selectedDebt, setSelectedDebt] = useState(null)
  const [marketData, setMarketData] = useState(null)
  const [loadingMarket, setLoadingMarket] = useState(false)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (!loading) loadMonthly() }, [month])

  const loadMarketData = useCallback(async () => {
    if (!investments.length) return
    setLoadingMarket(true)
    try {
      const data = await market.getAllMarketPrices(investments)
      setMarketData(data)
    } catch (e) { console.error('Error loading market data:', e) }
    setLoadingMarket(false)
  }, [investments])

  useEffect(() => {
    if (investments.length > 0) loadMarketData()
  }, [investments, loadMarketData])

  const loadData = async () => {
    try {
      setLoading(true)
      const [w, cat, med, cards, d, ac, sh, inv, fe] = await Promise.all([
        db.getWallets(), db.getCategories(), db.getMedicalRecords(), db.getCreditCards(), 
        db.getDebtsByPerson(), db.getApartmentConfig(), db.getSalaryHistory(), db.getInvestments(),
        db.getFixedExpenses()
      ])
      setWallets(w); setCategories(cat); setMedicalRecords(med)
      setCreditCards(cards); setDebts(d); setAptConfig(ac)
      setSalaryHistory(sh); setInvestments(inv); setFixedExpenses(fe)
      await loadMonthly()
    } catch (e) { console.error('Error loading data:', e) } 
    finally { setLoading(false) }
  }

  const loadMonthly = async () => {
    const [tx, sum, as, ae, ce] = await Promise.all([
      db.getTransactions({ month, ...filters }), db.getMonthlySummary(month), 
      db.getApartmentSalaries(month), db.getApartmentExpenses(month), 
      db.getInstallmentsByStatementMonth(month)
    ])
    setTransactions(tx); setSummary(sum); setAptSalaries(as); setAptExpenses(ae); setCardExpenses(ce)
  }

  // Refresh all data
  const refreshData = async () => {
    const [w, tx, sum, d, inv] = await Promise.all([
      db.getWallets(),
      db.getTransactions({ month, ...filters }),
      db.getMonthlySummary(month),
      db.getDebtsByPerson(),
      db.getInvestments()
    ])
    setWallets(w)
    setTransactions(tx)
    setSummary(sum)
    setDebts(d)
    setInvestments(inv)
  }

  // Refresh when changing tabs
  useEffect(() => {
    if (!loading) {
      refreshData()
    }
  }, [tab])

  const loadDebts = async () => {
    const d = await db.getDebtsByPerson()
    setDebts(d)
    if (selectedDebt) {
      const updated = d.find(debt => debt.name === selectedDebt.name)
      if (updated) setSelectedDebt(updated)
    }
  }

  // Handlers
  const saveTx = async (f) => { 
    await db.createTransaction({ ...f, amount: +f.amount })
    setModals(p => ({ ...p, tx: false }))
    await refreshData()
  }
  
  // NEW: Transfer handler - creates linked transactions that don't affect summary
  const saveTransfer = async (f) => {
    const fromWallet = wallets.find(w => w.id === f.from_wallet_id)
    const toWallet = wallets.find(w => w.id === f.to_wallet_id)
    
    // Crear egreso en billetera origen (marcado como traspaso)
    await db.createTransaction({
      date: f.date,
      description: `↔️ ${f.description} → ${toWallet?.name || 'otra billetera'}`,
      amount: f.amount,
      currency: f.currency,
      type: 'traspaso_out',
      wallet_id: f.from_wallet_id
    })
    // Crear ingreso en billetera destino (marcado como traspaso)
    await db.createTransaction({
      date: f.date,
      description: `↔️ ${f.description} ← ${fromWallet?.name || 'otra billetera'}`,
      amount: f.amount,
      currency: f.currency,
      type: 'traspaso_in',
      wallet_id: f.to_wallet_id
    })
    setModals(p => ({ ...p, tx: false }))
    await refreshData()
  }
  
  const saveCard = async (f) => { 
    try {
      await db.createCreditCardExpense(f)
      setModals(p => ({ ...p, card: false }))
      await loadMonthly()
      await loadDebts()
    } catch (e) {
      console.error('Error saving card expense:', e)
      alert('Error al guardar: ' + e.message)
    }
  }
  
  const saveManualDebt = async (f) => {
    try {
      await db.createManualDebt(f)
      setModals(p => ({ ...p, debt: false }))
      await loadDebts()
    } catch (e) {
      console.error('Error saving manual debt:', e)
      alert('Error al guardar')
    }
  }
  
  const saveInv = async (f) => { 
    try {
      await db.addInvestmentTransaction(f)
      setModals(p => ({ ...p, inv: false }))
      const inv = await db.getInvestments()
      setInvestments(inv)
    } catch (e) {
      console.error('Error with investment:', e)
      alert(e.message || 'Error al procesar la operación')
    }
  }
  
  const deleteInvestment = async (id) => {
    if (!confirm('¿Eliminar esta inversión?')) return
    try {
      await db.deleteInvestment(id)
      const inv = await db.getInvestments()
      setInvestments(inv)
    } catch (e) {
      console.error('Error deleting investment:', e)
      alert('Error al eliminar')
    }
  }
  
  // UPDATED: Salary now creates transaction with today's date
  const saveSalary = async (f) => { 
    await db.addSalaryRecord(f)
    
    // Crear transacción de ingreso con fecha de HOY
    const totalSalary = (parseFloat(f.net_salary) || 0) + (parseFloat(f.bonus) || 0)
    
    await db.createTransaction({
      date: format(new Date(), 'yyyy-MM-dd'), // Usar fecha actual
      description: `Sueldo ${formatMonth(f.month)}${f.bonus ? ' + Bonus' : ''}`,
      amount: totalSalary,
      currency: 'ARS',
      type: 'ingreso',
      wallet_id: f.wallet_id,
      category_id: f.category_id
    })
    
    setModals(p => ({ ...p, salary: false }))
    setSalaryHistory(await db.getSalaryHistory())
    await refreshData()
  }
  
  const saveApt = async (f) => { 
    await db.createApartmentExpense({ month, ...f })
    setModals(p => ({ ...p, apt: false }))
    setAptExpenses(await db.getApartmentExpenses(month)) 
  }
  
  const saveAptSalary = async (name, sal) => { 
    await db.setApartmentSalary(month, name, sal)
    setAptSalaries(await db.getApartmentSalaries(month)) 
  }

  const handleMarkInstallmentPaid = async (expenseId, installmentNumber, walletId) => {
    try {
      await db.markInstallmentPaid(expenseId, installmentNumber, walletId)
      await loadDebts()
      setWallets(await db.getWallets())
    } catch (e) {
      console.error('Error marking as paid:', e)
      alert('Error: ' + e.message)
    }
  }
  
  const handleMarkManualDebtPaid = async (debtId, walletId) => {
    try {
      await db.markManualDebtPaid(debtId, walletId)
      await loadDebts()
      setWallets(await db.getWallets())
    } catch (e) {
      console.error('Error marking as paid:', e)
      alert('Error: ' + e.message)
    }
  }

  // Calcs
  const totalArs = wallets.filter(w => w.currency === 'ARS').reduce((s, w) => s + (+w.balance || 0), 0)
  const totalUsd = wallets.filter(w => w.currency === 'USD').reduce((s, w) => s + (+w.balance || 0), 0)
  const totalInvArs = investments.filter(i => i.currency === 'ARS').reduce((s, i) => s + (+i.total_invested || 0), 0)
  const totalInvUsd = investments.filter(i => i.currency === 'USD').reduce((s, i) => s + (+i.total_invested || 0), 0)
  const cardsByCard = creditCards.map(c => ({ ...c, expenses: cardExpenses.filter(e => e.card_id === c.id), totalArs: cardExpenses.filter(e => e.card_id === c.id && e.currency === 'ARS').reduce((s, e) => s + (+e.installment_amount || 0), 0), totalUsd: cardExpenses.filter(e => e.card_id === c.id && e.currency === 'USD').reduce((s, e) => s + (+e.installment_amount || 0), 0) }))
  const totalCardArs = cardsByCard.reduce((s, c) => s + c.totalArs, 0)
  const totalCardUsd = cardsByCard.reduce((s, c) => s + c.totalUsd, 0)
  const totalAptExp = aptExpenses.reduce((s, e) => s + (+e.amount || 0), 0)
  const totalAptSal = aptSalaries.reduce((s, e) => s + (+e.salary || 0), 0)
  const completed = medicalRecords.filter(r => r.status === 'completed')
  const weightData = completed.filter(r => r.weight).map(r => ({ date: format(parseISO(r.date), 'MM/yy'), weight: r.weight })).reverse()

  const tabs = [
    { id: 'dashboard', icon: Home, label: 'Inicio' },
    { id: 'transactions', icon: Wallet, label: 'Movim.' },
    { id: 'cards', icon: CreditCard, label: 'Tarjetas' },
    { id: 'debts', icon: Users, label: 'Deudas' },
  ]
  const moreTabs = [
    { id: 'apartment', icon: Building2, label: 'Depto' },
    { id: 'salary', icon: DollarSign, label: 'Sueldo' },
    { id: 'investments', icon: TrendingUp, label: 'Inversiones' },
    { id: 'medical', icon: Stethoscope, label: 'Médico' },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Cargando...</p>
      </div>
    </div>
  )

  // ============================================
  // SECTIONS
  // ============================================
  
  const Dashboard = () => {
    const [showFixedExpenses, setShowFixedExpenses] = useState(false)
    const [editingFixed, setEditingFixed] = useState(null)
    const [fixedForm, setFixedForm] = useState({ name: '', amount: '', icon: '📌' })
    
    // Calcular mi parte del depto
    const myName = 'Julian' // Tu nombre en apartment_config
    const getSal = n => aptSalaries.find(s => s.person_name === n)?.salary || 0
    const myShare = aptConfig.length > 0 ? (() => {
      const mySalary = getSal(myName)
      const totalSalaries = aptConfig.reduce((sum, p) => sum + getSal(p.person_name), 0)
      const sharePercent = totalSalaries > 0 ? (mySalary / totalSalaries) * 100 : (aptConfig.find(p => p.person_name === myName)?.percentage || 50)
      return (sharePercent / 100) * totalAptExp
    })() : 0
    
    // Gastos fijos totales
    const fixedExpensesTotal = fixedExpenses.reduce((sum, fe) => sum + (parseFloat(fe.amount) || 0), 0)
    const totalGastosFijos = totalCardArs + fixedExpensesTotal + myShare
    
    const saveFixedExpense = async () => {
      try {
        if (editingFixed) {
          await db.updateFixedExpense(editingFixed.id, {
            name: fixedForm.name,
            amount: parseFloat(fixedForm.amount) || 0,
            icon: fixedForm.icon
          })
        } else {
          await db.createFixedExpense(fixedForm)
        }
        setFixedExpenses(await db.getFixedExpenses())
        setEditingFixed(null)
        setFixedForm({ name: '', amount: '', icon: '📌' })
      } catch (e) {
        console.error('Error saving fixed expense:', e)
        alert('Error al guardar')
      }
    }
    
    const deleteFixed = async (id) => {
      if (!confirm('¿Eliminar este gasto fijo?')) return
      try {
        await db.deleteFixedExpense(id)
        setFixedExpenses(await db.getFixedExpenses())
      } catch (e) {
        console.error('Error deleting:', e)
      }
    }
    
    return (
      <div className="space-y-4">
        <Tabs value={currency} onValueChange={setCurrency}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ARS">🇦🇷 Pesos</TabsTrigger>
            <TabsTrigger value="USD">🇺🇸 Dólares</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid grid-cols-2 gap-3">
          <StatCard title="Balance" value={formatCurrency(currency === 'ARS' ? totalArs : totalUsd, currency)} icon={Wallet} variant="primary" />
          <StatCard title="Invertido" value={formatCurrency(currency === 'ARS' ? totalInvArs : totalInvUsd, currency)} icon={TrendingUp} variant="purple" />
          <StatCard title="Ingresos" value={formatCurrency(currency === 'ARS' ? summary.income_ars : summary.income_usd, currency)} icon={ArrowUpRight} variant="success" />
          <StatCard title="Gastos Fijos" value={formatCurrency(totalGastosFijos)} icon={CreditCard} variant="danger" />
        </div>
        
        {/* SECCIÓN GASTOS FIJOS */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">📋 Gastos Fijos del Mes</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowFixedExpenses(!showFixedExpenses)}>
                {showFixedExpenses ? 'Ocultar' : 'Ver detalle'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Resumen rápido */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-red-500/20 rounded-lg p-2 text-center">
                <p className="text-xs text-red-400">Tarjetas</p>
                <p className="font-bold text-red-400 text-sm">{formatCurrency(totalCardArs)}</p>
              </div>
              <div className="bg-orange-500/20 rounded-lg p-2 text-center">
                <p className="text-xs text-orange-400">Otros Fijos</p>
                <p className="font-bold text-orange-400 text-sm">{formatCurrency(fixedExpensesTotal)}</p>
              </div>
              <div className="bg-blue-500/20 rounded-lg p-2 text-center">
                <p className="text-xs text-blue-400">Mi Depto</p>
                <p className="font-bold text-blue-400 text-sm">{formatCurrency(myShare)}</p>
              </div>
            </div>
            
            {showFixedExpenses && (
              <div className="space-y-3 border-t border-border pt-3">
                {/* Tarjetas de crédito */}
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-2">💳 TARJETAS</p>
                  {cardsByCard.map(card => (
                    <div key={card.id} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-sm">{card.icon} {card.name}</span>
                      <span className={cn('font-medium text-sm', card.totalArs > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                        {card.totalArs > 0 ? formatCurrency(card.totalArs) : '$0'}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Gastos fijos personalizados */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-muted-foreground font-semibold">📌 OTROS GASTOS FIJOS</p>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                      setEditingFixed(null)
                      setFixedForm({ name: '', amount: '', icon: '📌' })
                    }}>
                      <Plus className="h-3 w-3 mr-1" />Agregar
                    </Button>
                  </div>
                  
                  {/* Form para agregar/editar */}
                  {(editingFixed !== null || fixedForm.name !== '' || fixedExpenses.length === 0) && !editingFixed && (
                    <div className="flex gap-2 mb-2">
                      <Input 
                        placeholder="Nombre..." 
                        value={fixedForm.name} 
                        onChange={e => setFixedForm(f => ({ ...f, name: e.target.value }))}
                        className="h-8 text-sm flex-1"
                      />
                      <Input 
                        type="number" 
                        placeholder="Monto" 
                        value={fixedForm.amount} 
                        onChange={e => setFixedForm(f => ({ ...f, amount: e.target.value }))}
                        className="h-8 text-sm w-24"
                      />
                      <Button size="sm" className="h-8" onClick={saveFixedExpense} disabled={!fixedForm.name}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  {fixedExpenses.map(fe => (
                    <div key={fe.id} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0 group">
                      {editingFixed?.id === fe.id ? (
                        <div className="flex gap-2 flex-1">
                          <Input 
                            value={fixedForm.name} 
                            onChange={e => setFixedForm(f => ({ ...f, name: e.target.value }))}
                            className="h-7 text-sm flex-1"
                          />
                          <Input 
                            type="number" 
                            value={fixedForm.amount} 
                            onChange={e => setFixedForm(f => ({ ...f, amount: e.target.value }))}
                            className="h-7 text-sm w-24"
                          />
                          <Button size="sm" className="h-7" onClick={saveFixedExpense}>
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm">{fe.icon} {fe.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={cn('font-medium text-sm', fe.amount > 0 ? 'text-orange-400' : 'text-muted-foreground')}>
                              {formatCurrency(fe.amount)}
                            </span>
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setEditingFixed(fe)
                                  setFixedForm({ name: fe.name, amount: fe.amount?.toString() || '', icon: fe.icon })
                                }}
                              >
                                ✏️
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 text-red-400"
                                onClick={() => deleteFixed(fe.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Mi parte del depto */}
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-2">🏠 MI PARTE DEL DEPTO</p>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-sm">Alquiler + Expensas + Servicios</span>
                    <span className="font-medium text-sm text-blue-400">{formatCurrency(myShare)}</span>
                  </div>
                  {totalAptExp === 0 && (
                    <p className="text-xs text-yellow-400">⚠️ Cargá los gastos del depto para ver tu parte</p>
                  )}
                </div>
                
                {/* TOTAL */}
                <div className="border-t-2 border-border pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">TOTAL GASTOS FIJOS</span>
                    <span className="font-bold text-lg text-red-400">{formatCurrency(totalGastosFijos)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="text-base">💰 Billeteras</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {wallets.filter(w => w.currency === currency).map(w => (
                <div key={w.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">{w.icon} {w.name}</span>
                  <span className="font-semibold">{formatCurrency(w.balance, currency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="text-base">Últimos Movimientos</CardTitle></CardHeader>
          <CardContent>
            {transactions.slice(0, 5).map(tx => <TransactionItem key={tx.id} tx={tx} />)}
            {!transactions.length && <p className="text-center text-muted-foreground py-4">Sin movimientos</p>}
          </CardContent>
        </Card>
      </div>
    )
  }

  const Transactions = () => {
    const apply = async (f) => { setFilters(f); setTransactions(await db.getTransactions({ month, ...f }) || []) }
    const totals = transactions.reduce((a, t) => { 
      // Excluir traspasos de los totales
      if (t.type === 'traspaso_in' || t.type === 'traspaso_out') return a
      if (t.type === 'ingreso') { 
        if (t.currency === 'USD') a.iu += +t.amount; else a.ia += +t.amount 
      } else { 
        if (t.currency === 'USD') a.eu += +t.amount; else a.ea += +t.amount 
      } 
      return a 
    }, { ia: 0, ea: 0, iu: 0, eu: 0 })
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Período</CardTitle>
              <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{getMonthOptions().map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/20 rounded-lg p-3 text-center"><p className="text-xs text-emerald-400">Ingresos</p><p className="font-bold text-emerald-400">{formatCurrency(totals.ia)}</p></div>
              <div className="bg-red-500/20 rounded-lg p-3 text-center"><p className="text-xs text-red-400">Egresos</p><p className="font-bold text-red-400">{formatCurrency(totals.ea)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filters.currency} onValueChange={v => apply({ ...filters, currency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas monedas</SelectItem><SelectItem value="ARS">🇦🇷 Pesos</SelectItem><SelectItem value="USD">🇺🇸 Dólares</SelectItem></SelectContent></Select>
              <Select value={filters.type} onValueChange={v => apply({ ...filters, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos tipos</SelectItem><SelectItem value="ingreso">Ingresos</SelectItem><SelectItem value="egreso">Egresos</SelectItem><SelectItem value="traspaso">Traspasos</SelectItem></SelectContent></Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Movimientos ({transactions.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {transactions.length ? transactions.map(tx => <TransactionItem key={tx.id} tx={tx} />) : <p className="text-center text-muted-foreground py-8">Sin movimientos</p>}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    )
  }

  const Cards = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base">💳 Tarjetas</CardTitle>
            <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{getMonthOptions().map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-500/20 rounded-lg p-3 text-center"><p className="text-xs text-red-400">Total ARS</p><p className="font-bold text-red-400">{formatCurrency(totalCardArs)}</p></div>
            <div className="bg-blue-500/20 rounded-lg p-3 text-center"><p className="text-xs text-blue-400">Total USD</p><p className="font-bold text-blue-400">{formatCurrency(totalCardUsd, 'USD')}</p></div>
          </div>
        </CardContent>
      </Card>
      <Button className="w-full" onClick={() => setModals(p => ({ ...p, card: true }))}><Plus className="h-4 w-4 mr-2" />Agregar Gasto</Button>
      {cardsByCard.map(c => (
        <Card key={c.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div><CardTitle className="text-base">{c.icon} {c.name}</CardTitle><CardDescription>Cierre: {c.closing_day} • Vto: {c.due_day}</CardDescription></div>
              <div className="text-right">{c.totalArs > 0 && <p className="font-bold">{formatCurrency(c.totalArs)}</p>}{c.totalUsd > 0 && <p className="font-bold text-blue-400">{formatCurrency(c.totalUsd, 'USD')}</p>}</div>
            </div>
          </CardHeader>
          <CardContent>
            {c.expenses.length ? c.expenses.map(e => (
              <div key={e.id} className={cn('p-3 rounded-lg mb-2', e.is_own_expense ? 'bg-muted/50' : 'bg-orange-500/20')}>
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-sm">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.purchase_date)} {e.total_installments > 1 && `• ${e.installment_number}/${e.total_installments}`}</p>
                    {!e.is_own_expense && <Badge className="mt-1 bg-orange-500">👤 {e.borrower_name}</Badge>}
                  </div>
                  <p className="font-semibold">{formatCurrency(e.installment_amount, e.currency)}</p>
                </div>
              </div>
            )) : <p className="text-center text-muted-foreground py-4">Sin gastos este mes</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )

  // DEUDAS - UPDATED with confirm button
  const Debts = () => {
    const arsWallets = wallets.filter(w => w.currency === 'ARS')
    const usdWallets = wallets.filter(w => w.currency === 'USD')
    
    // State for pending payments
    const [pendingPayments, setPendingPayments] = useState({})
    
    const setPaymentWallet = (key, walletId) => {
      setPendingPayments(p => ({ ...p, [key]: walletId }))
    }
    
    const confirmPayment = async (type, id, data) => {
      const key = `${type}-${id}`
      const walletId = pendingPayments[key]
      if (!walletId) return alert('Seleccioná una billetera')
      
      if (type === 'manual') {
        await handleMarkManualDebtPaid(id, walletId)
      } else {
        await handleMarkInstallmentPaid(data.expense_id, data.installment_number, walletId)
      }
      
      // Clear pending
      setPendingPayments(p => {
        const newP = { ...p }
        delete newP[key]
        return newP
      })
    }
    
    const pendingInstallments = selectedDebt?.installments?.filter(i => !i.is_paid) || []
    const pendingManualDebts = selectedDebt?.manualDebts?.filter(d => !d.is_paid) || []
    const paidInstallments = selectedDebt?.installments?.filter(i => i.is_paid) || []
    const paidManualDebts = selectedDebt?.manualDebts?.filter(d => d.is_paid) || []
    
    const installmentsByMonth = {}
    pendingInstallments.forEach(i => {
      if (!installmentsByMonth[i.statement_month]) installmentsByMonth[i.statement_month] = []
      installmentsByMonth[i.statement_month].push(i)
    })
    
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base">👥 Deudas</CardTitle>
                <CardDescription>Personas que te deben</CardDescription>
              </div>
              <Button size="sm" onClick={() => setModals(m => ({ ...m, debt: true }))}>
                <Plus className="h-4 w-4 mr-1" />Nueva
              </Button>
            </div>
          </CardHeader>
        </Card>
        
        {!debts.length ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Check className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
              <p className="text-muted-foreground">No hay deudas pendientes</p>
              <Button variant="link" onClick={() => setModals(m => ({ ...m, debt: true }))}>Agregar una deuda</Button>
            </CardContent>
          </Card>
        ) : debts.map(p => (
          <Card key={p.name} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedDebt(p); setModals(m => ({ ...m, debtDetail: true })); setPendingPayments({}) }}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">👤 {p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(p.installments?.filter(i => !i.is_paid).length || 0) + (p.manualDebts?.filter(d => !d.is_paid).length || 0)} pendientes
                  </p>
                </div>
                <div className="text-right">
                  {p.total_pending_ars > 0 && <p className="font-bold text-red-400">{formatCurrency(p.total_pending_ars)}</p>}
                  {p.total_pending_usd > 0 && <p className="font-bold text-red-400">{formatCurrency(p.total_pending_usd, 'USD')}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Dialog detalle - UPDATED with confirm button */}
        <Dialog open={modals.debtDetail} onOpenChange={o => setModals(m => ({ ...m, debtDetail: o }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>👤 {selectedDebt?.name}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              {selectedDebt && (
                <div className="space-y-4">
                  {/* Deudas manuales pendientes */}
                  {pendingManualDebts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">📝 Gastos del día a día</h4>
                      {pendingManualDebts.map(d => {
                        const key = `manual-${d.id}`
                        return (
                          <div key={d.id} className="p-3 rounded-lg mb-2 bg-muted/50">
                            <div className="flex justify-between mb-2">
                              <div>
                                <p className="font-medium text-sm">{d.description}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                              </div>
                              <p className="font-semibold">{formatCurrency(d.amount, d.currency)}</p>
                            </div>
                            <div className="flex gap-2">
                              <Select value={pendingPayments[key] || ''} onValueChange={v => setPaymentWallet(key, v)}>
                                <SelectTrigger className="h-8 flex-1">
                                  <SelectValue placeholder="Seleccionar billetera..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(d.currency === 'USD' ? usdWallets : arsWallets).map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.icon} {w.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={!pendingPayments[key]}
                                onClick={() => confirmPayment('manual', d.id, null)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  
                  {/* Cuotas de tarjeta pendientes */}
                  {Object.keys(installmentsByMonth).length > 0 && (
                    <div>
                      {Object.keys(installmentsByMonth).sort().map(m => (
                        <div key={m} className="mb-4">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-2 capitalize">💳 {formatMonth(m)}</h4>
                          {installmentsByMonth[m].map(i => {
                            const key = `inst-${i.id}`
                            return (
                              <div key={i.id} className="p-3 rounded-lg mb-2 bg-muted/50">
                                <div className="flex justify-between mb-2">
                                  <div>
                                    <p className="font-medium text-sm">{i.description}</p>
                                    <p className="text-xs text-muted-foreground">{i.card?.name} {i.total_installments > 1 && `• ${i.installment_number}/${i.total_installments}`}</p>
                                  </div>
                                  <p className="font-semibold">{formatCurrency(i.installment_amount, i.currency)}</p>
                                </div>
                                <div className="flex gap-2">
                                  <Select value={pendingPayments[key] || ''} onValueChange={v => setPaymentWallet(key, v)}>
                                    <SelectTrigger className="h-8 flex-1">
                                      <SelectValue placeholder="Seleccionar billetera..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(i.currency === 'USD' ? usdWallets : arsWallets).map(w => (
                                        <SelectItem key={w.id} value={w.id}>{w.icon} {w.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button 
                                    size="sm" 
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    disabled={!pendingPayments[key]}
                                    onClick={() => confirmPayment('inst', i.id, i)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Sin deudas pendientes */}
                  {pendingManualDebts.length === 0 && pendingInstallments.length === 0 && (
                    <div className="text-center py-4">
                      <Check className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                      <p className="text-muted-foreground">Sin deudas pendientes</p>
                    </div>
                  )}
                  
                  {/* Pagadas */}
                  {(paidManualDebts.length > 0 || paidInstallments.length > 0) && (
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-sm font-semibold text-emerald-400 mb-2">✓ Pagadas</h4>
                      {paidManualDebts.map(d => (
                        <div key={d.id} className="p-2 rounded-lg mb-1 bg-emerald-500/20 text-sm flex justify-between">
                          <span>{d.description}</span>
                          <span>{formatCurrency(d.amount, d.currency)}</span>
                        </div>
                      ))}
                      {paidInstallments.map(i => (
                        <div key={i.id} className="p-2 rounded-lg mb-1 bg-emerald-500/20 text-sm flex justify-between">
                          <span>{i.description} {i.total_installments > 1 && `(${i.installment_number}/${i.total_installments})`}</span>
                          <span>{formatCurrency(i.installment_amount, i.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const Apartment = () => {
    const [editing, setEditing] = useState(null), [val, setVal] = useState('')
    const getSal = n => aptSalaries.find(s => s.person_name === n)?.salary || 0
    const shares = aptConfig.map(p => { const sal = getSal(p.person_name), share = totalAptSal > 0 ? (sal / totalAptSal) * 100 : p.percentage, owes = (share / 100) * totalAptExp, paid = aptExpenses.filter(e => e.paid_by === p.person_name).reduce((s, e) => s + +e.amount, 0); return { ...p, sal, share, owes, paid, balance: paid - owes } })
    
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">🏠 Gastos Depto</CardTitle>
              <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{getMonthOptions().map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent><div className="bg-blue-500/20 rounded-lg p-4 text-center"><p className="text-xs text-blue-400">Total Gastos</p><p className="text-2xl font-bold text-blue-400">{formatCurrency(totalAptExp)}</p></div></CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">💰 Sueldos del mes</CardTitle>
            <CardDescription>Tocá el monto para editar</CardDescription>
          </CardHeader>
          <CardContent>
            {aptConfig.map(p => {
              const currentSalary = getSal(p.person_name)
              return (
                <div key={p.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg mb-2">
                  <div>
                    <span className="font-medium">{p.person_name}</span>
                    {currentSalary === 0 && <p className="text-xs text-yellow-400">⚠️ Sin cargar</p>}
                  </div>
                  {editing === p.person_name ? (
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        className="w-28 h-8" 
                        value={val} 
                        onChange={e => setVal(e.target.value)}
                        placeholder="Sueldo..."
                        autoFocus
                      />
                      <Button size="sm" onClick={() => { saveAptSalary(p.person_name, +val); setEditing(null) }}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant={currentSalary > 0 ? "ghost" : "outline"} 
                      size="sm" 
                      onClick={() => { setEditing(p.person_name); setVal(currentSalary || '') }}
                      className={currentSalary > 0 ? "font-semibold" : "text-yellow-400 border-yellow-400"}
                    >
                      {currentSalary > 0 ? formatCurrency(currentSalary) : '+ Cargar sueldo'}
                    </Button>
                  )}
                </div>
              )
            })}
            {totalAptSal > 0 && (
              <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
                <span className="text-muted-foreground">Total sueldos:</span>
                <span className="font-bold">{formatCurrency(totalAptSal)}</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="text-base">📊 Distribución</CardTitle></CardHeader>
          <CardContent>
            {shares.map(p => (
              <div key={p.id} className={cn('p-3 rounded-lg mb-2', p.balance >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20')}>
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{p.person_name}</span>
                  <Badge className={p.balance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}>{p.share.toFixed(0)}%</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>Debe: <span className="font-medium">{formatCurrency(p.owes)}</span></div>
                  <div>Pagó: <span className="font-medium">{formatCurrency(p.paid)}</span></div>
                  <div>Saldo: <span className={cn('font-bold', p.balance >= 0 ? 'text-emerald-400' : 'text-red-400')}>{p.balance >= 0 ? '+' : ''}{formatCurrency(p.balance)}</span></div>
                </div>
              </div>
            ))}
            {totalAptSal === 0 && (
              <p className="text-center text-yellow-400 text-sm py-2">
                ⚠️ Cargá los sueldos para calcular la distribución proporcional
              </p>
            )}
          </CardContent>
        </Card>
        
        <Button className="w-full" onClick={() => setModals(p => ({ ...p, apt: true }))}><Plus className="h-4 w-4 mr-2" />Agregar Gasto</Button>
        
        <Card>
          <CardHeader><CardTitle className="text-base">📋 Gastos del mes</CardTitle></CardHeader>
          <CardContent>
            {aptExpenses.length ? aptExpenses.map(e => (
              <div key={e.id} className="flex justify-between items-center p-2 border-b border-border last:border-0">
                <div><p className="font-medium text-sm">{e.description}</p><p className="text-xs text-muted-foreground">{e.category} • {e.paid_by}</p></div>
                <span className="font-semibold">{formatCurrency(e.amount)}</span>
              </div>
            )) : <p className="text-center text-muted-foreground py-4">Sin gastos</p>}
          </CardContent>
        </Card>
      </div>
    )
  }

  const Salary = () => {
    const data = [...salaryHistory].reverse().map(s => ({ month: format(parseISO(s.month), 'MM/yy'), sueldo: s.net_salary }))
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">💰 Evolución Sueldo</CardTitle></CardHeader>
          <CardContent>
            {salaryHistory.length > 0 && <div className="text-center mb-4"><p className="text-xs text-muted-foreground">Último sueldo</p><p className="text-2xl font-bold text-emerald-400">{formatCurrency(salaryHistory[0]?.net_salary)}</p></div>}
            {data.length > 1 && (
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={data}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="sueldo" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Button className="w-full" onClick={() => setModals(p => ({ ...p, salary: true }))}><Plus className="h-4 w-4 mr-2" />Registrar Sueldo</Button>
        <Card>
          <CardHeader><CardTitle className="text-base">📋 Historial</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {salaryHistory.length ? salaryHistory.map(s => (
                <div key={s.id} className="flex justify-between items-center p-2 border-b border-border last:border-0">
                  <div><p className="font-medium text-sm capitalize">{formatMonth(s.month.substring(0, 7))}</p>{s.bonus > 0 && <Badge variant="secondary" className="mt-1">+{formatCurrency(s.bonus)} bonus</Badge>}</div>
                  <span className="font-semibold text-emerald-400">{formatCurrency(s.net_salary)}</span>
                </div>
              )) : <p className="text-center text-muted-foreground py-4">Sin registros</p>}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    )
  }

  const Investments = () => {
    const [plat, setPlat] = useState('all')
    const filtered = plat === 'all' ? investments : investments.filter(i => i.platform === plat)
    const dolarBlue = marketData?.dolarBlue?.promedio || 1500
    
    const portfolio = market.calculateFullPortfolio(filtered, marketData || { prices: {}, dolarBlue: { promedio: dolarBlue } })
    
    const fmtUSD = (n) => '$' + (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
    const fmtUSDDecimal = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const fmtPercent = (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`
    const fmtARS = (n) => formatCurrency(n, 'ARS')
    
    const getPieData = () => { 
      if (portfolio && portfolio.byCurrency.length > 0) return portfolio.byCurrency
      const byPlat = { 'Crypto': 0, 'CEDEARs': 0, 'US Stocks': 0 }
      filtered.forEach(inv => { 
        const invested = parseFloat(inv.total_invested) || 0
        const valueUSD = inv.currency === 'ARS' ? invested / dolarBlue : invested
        if (inv.platform === 'cripto') byPlat['Crypto'] += valueUSD
        else if (inv.platform === 'iol') byPlat['CEDEARs'] += valueUSD
        else byPlat['US Stocks'] += valueUSD 
      })
      const total = Object.values(byPlat).reduce((a, b) => a + b, 0)
      return Object.entries(byPlat).filter(([_, v]) => v > 0).map(([name, value]) => ({ 
        name: name === 'Crypto' ? '🪙 Crypto' : name === 'CEDEARs' ? '🇦🇷 CEDEARs' : '🇺🇸 US Stocks', 
        value: Math.round(value * 100) / 100, 
        percentage: total > 0 ? Math.round((value / total) * 1000) / 10 : 0 
      })) 
    }
    const pieData = getPieData()
    const displayTotal = portfolio?.totalValueUSD || 0
    const hasAnyMarketPrice = portfolio?.positions?.some(p => p.hasMarketPrice)
    
    return (
      <div className="space-y-4">
        <Card className={cn('border-0 text-white', 
          portfolio.totalProfitPercent === 0 ? 'bg-gradient-to-br from-purple-600 to-purple-700' : 
          portfolio.totalProfitPercent > 0 ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 
          'bg-gradient-to-br from-red-600 to-red-700')}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-white/80">Portafolio Total</p>
                <p className="text-3xl font-bold mt-1">{fmtUSD(displayTotal)}</p>
                {hasAnyMarketPrice ? (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="px-2 py-1 rounded text-sm font-medium bg-white/20">{fmtPercent(portfolio.totalProfitPercent)} total</span>
                    <span className="px-2 py-1 rounded text-sm bg-white/20">{fmtPercent(portfolio.change24hPercent)} 24h</span>
                  </div>
                ) : (
                  <p className="text-xs text-white/60 mt-2">💡 Mostrando valor invertido (sin precios de mercado)</p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={loadMarketData} disabled={loadingMarket}>
                {loadingMarket ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
              <div><p className="text-xs text-white/70">Invertido</p><p className="font-semibold">{fmtUSD(portfolio.totalCostUSD)}</p></div>
              <div><p className="text-xs text-white/70">Ganancia</p><p className="font-semibold">{portfolio.totalProfitUSD >= 0 ? '+' : ''}{fmtUSD(portfolio.totalProfitUSD)}</p></div>
              <div><p className="text-xs text-white/70">24h</p><p className="font-semibold">{portfolio.change24hUSD >= 0 ? '+' : ''}{fmtUSDDecimal(portfolio.change24hUSD)}</p></div>
            </div>
          </CardContent>
        </Card>
        
        {marketData && <Card><CardHeader className="pb-2"><div className="flex justify-between items-center"><CardTitle className="text-base">📊 Cotizaciones</CardTitle><span className="text-xs text-muted-foreground">Blue: ${marketData.dolarBlue?.promedio?.toLocaleString('es-AR')}</span></div></CardHeader><CardContent><div className="grid grid-cols-4 gap-2">{['BTC', 'ETH', 'SOL'].map(symbol => { const data = marketData.prices[symbol]; if (!data) return null; return <div key={symbol} className="bg-muted/50 rounded-lg p-2 text-center"><p className="text-xs text-muted-foreground">{symbol}</p><p className="font-bold text-sm">${data.price?.toLocaleString()}</p><p className={cn('text-xs', data.change24h >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmtPercent(data.change24h)}</p></div> })}<div className="bg-muted/50 rounded-lg p-2 text-center"><p className="text-xs text-muted-foreground">USD</p><p className="font-bold text-sm">${marketData.dolarBlue?.promedio?.toLocaleString('es-AR')}</p><p className="text-xs text-muted-foreground">Blue</p></div></div></CardContent></Card>}
        
        <Tabs value={plat} onValueChange={setPlat}><TabsList className="grid w-full grid-cols-4"><TabsTrigger value="all">Todo</TabsTrigger><TabsTrigger value="cripto">🪙</TabsTrigger><TabsTrigger value="iol">🇦🇷</TabsTrigger><TabsTrigger value="usa">🇺🇸</TabsTrigger></TabsList></Tabs>
        
        {pieData.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">🥧 Composición</CardTitle></CardHeader><CardContent><div className="flex items-center gap-4"><div className="w-32 h-32"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={2}>{pieData.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip content={<CustomPieTooltip />} /></PieChart></ResponsiveContainer></div><div className="flex-1 space-y-2">{pieData.map((item, index) => <div key={item.name} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} /><span className="text-sm">{item.name}</span></div><div className="text-right"><span className="font-semibold text-sm">{item.percentage}%</span><p className="text-xs text-muted-foreground">{fmtUSD(item.value)}</p></div></div>)}</div></div></CardContent></Card>}
        
        <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => setModals(p => ({ ...p, inv: true }))}><Plus className="h-4 w-4 mr-2" />Nueva Operación</Button>
        
        <Card><CardHeader><CardTitle className="text-base">📋 Posiciones</CardTitle></CardHeader><CardContent><ScrollArea className="h-[400px]">{filtered.length ? filtered.map(inv => { 
          const symbol = inv.asset_symbol?.toUpperCase()
          const priceKey = `${inv.platform}:${symbol}`
          const pos = portfolio?.positions?.find(p => p.symbol === symbol && p.platform === inv.platform)
          const priceData = marketData?.prices?.[priceKey]
          const hasPrice = priceData && priceData.price > 0
          
          return (
            <div key={inv.id} className="p-3 bg-muted/50 rounded-lg mb-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{inv.platform === 'cripto' ? '🪙' : inv.platform === 'iol' ? '🇦🇷' : '🇺🇸'}</span>
                  <div>
                    <p className="font-bold">{symbol}</p>
                    <p className="text-xs text-muted-foreground">{inv.quantity} unidades</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-bold">{pos ? fmtUSD(pos.currentValueUSD) : fmtUSD(inv.total_invested)}</p>
                    {hasPrice ? (
                      <p className={cn('text-xs font-medium', (pos?.profitLossPercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmtPercent(pos?.profitLossPercent || 0)}</p>
                    ) : (
                      <p className="text-xs text-yellow-400">⚠️ Sin cotización</p>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/20"
                    onClick={() => deleteInvestment(inv.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-background/50 rounded p-2">
                  <p className="text-muted-foreground">Actual</p>
                  <p className="font-semibold">{hasPrice ? (inv.platform === 'iol' ? fmtARS(priceData.price) : fmtUSDDecimal(priceData.price)) : <span className="text-yellow-400">N/A</span>}</p>
                </div>
                <div className="bg-background/50 rounded p-2">
                  <p className="text-muted-foreground">Compra</p>
                  <p className="font-semibold">{inv.platform === 'iol' ? fmtARS(inv.avg_price) : fmtUSDDecimal(inv.avg_price)}</p>
                </div>
                <div className="bg-background/50 rounded p-2">
                  <p className="text-muted-foreground">Ganancia</p>
                  <p className={cn('font-semibold', hasPrice ? ((pos?.profitLossUSD || 0) >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-muted-foreground')}>
                    {hasPrice ? `${(pos?.profitLossUSD || 0) >= 0 ? '+' : ''}${fmtUSDDecimal(pos?.profitLossUSD || 0)}` : '-'}
                  </p>
                </div>
                <div className="bg-background/50 rounded p-2">
                  <p className="text-muted-foreground">24h</p>
                  <p className={cn('font-semibold', hasPrice ? ((priceData?.change24h || 0) >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-muted-foreground')}>
                    {hasPrice ? fmtPercent(priceData?.change24h || 0) : '-'}
                  </p>
                </div>
              </div>
              
              {hasPrice && pos && (
                <div className="mt-2">
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', pos.profitLossPercent >= 0 ? 'bg-emerald-500' : 'bg-red-500')} style={{ width: `${Math.min(Math.abs(pos.profitLossPercent), 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )
        }) : <div className="text-center py-8"><TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Sin inversiones</p></div>}</ScrollArea></CardContent></Card>
      </div>
    )
  }

  const Medical = () => (
    <div className="space-y-4">
      {weightData.length > 0 && <Card><CardHeader className="pb-2"><div className="flex justify-between"><CardTitle className="text-base">⚖️ Peso</CardTitle><span className="text-xl font-bold">{weightData[weightData.length - 1]?.weight} kg</span></div></CardHeader><CardContent><ResponsiveContainer width="100%" height={80}><LineChart data={weightData}><XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} /><YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} /><Tooltip formatter={v => `${v} kg`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} /><Line type="monotone" dataKey="weight" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} /></LineChart></ResponsiveContainer></CardContent></Card>}
      <Card><CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader><CardContent><ScrollArea className="h-[300px]">{completed.length ? completed.map(r => <div key={r.id} className="p-3 bg-muted/50 rounded-lg mb-2"><div className="flex justify-between"><div><p className="font-medium text-sm">{r.description}</p><p className="text-xs text-muted-foreground">{formatDate(r.date)}</p></div>{r.weight && <Badge variant="secondary">{r.weight} kg</Badge>}</div></div>) : <p className="text-center text-muted-foreground py-4">Sin controles</p>}</ScrollArea></CardContent></Card>
    </div>
  )

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-bold flex items-center gap-2"><PiggyBank className="h-6 w-6 text-primary" />Cash Flow</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refreshData} title="Actualizar datos">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setModals(p => ({ ...p, tx: true }))}><Plus className="h-4 w-4 mr-1" />Nuevo</Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-4 py-4 pb-24">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'transactions' && <Transactions />}
        {tab === 'cards' && <Cards />}
        {tab === 'debts' && <Debts />}
        {tab === 'apartment' && <Apartment />}
        {tab === 'salary' && <Salary />}
        {tab === 'investments' && <Investments />}
        {tab === 'medical' && <Medical />}
      </main>
      
      <Sheet open={modals.more} onOpenChange={o => setModals(m => ({ ...m, more: o }))}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Más opciones</SheetTitle></SheetHeader>
          <div className="grid grid-cols-4 gap-4 py-4">
            {moreTabs.map(t => <button key={t.id} onClick={() => { setTab(t.id); setModals(m => ({ ...m, more: false })) }} className={cn('flex flex-col items-center gap-2 p-4 rounded-lg transition-colors', tab === t.id ? 'bg-primary/20 text-primary' : 'hover:bg-muted')}><t.icon className="h-6 w-6" /><span className="text-xs">{t.label}</span></button>)}
          </div>
        </SheetContent>
      </Sheet>
      
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-40">
        <div className="max-w-lg mx-auto px-2 py-2 flex justify-around">
          {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex flex-col items-center py-2 px-3 rounded-xl transition-colors', tab === t.id ? 'text-primary bg-primary/10' : 'text-muted-foreground')}><t.icon className="h-5 w-5" /><span className="text-xs mt-1">{t.label}</span></button>)}
          <button onClick={() => setModals(m => ({ ...m, more: true }))} className={cn('flex flex-col items-center py-2 px-3 rounded-xl transition-colors', moreTabs.some(t => t.id === tab) ? 'text-primary bg-primary/10' : 'text-muted-foreground')}><MoreHorizontal className="h-5 w-5" /><span className="text-xs mt-1">Más</span></button>
        </div>
      </nav>
      
      <TransactionModal open={modals.tx} onOpenChange={o => setModals(m => ({ ...m, tx: o }))} onSave={saveTx} onTransfer={saveTransfer} wallets={wallets} categories={categories} />
      <CreditCardModal open={modals.card} onOpenChange={o => setModals(m => ({ ...m, card: o }))} onSave={saveCard} cards={creditCards} />
      <ManualDebtModal open={modals.debt} onOpenChange={o => setModals(m => ({ ...m, debt: o }))} onSave={saveManualDebt} />
      <InvestmentModal open={modals.inv} onOpenChange={o => setModals(m => ({ ...m, inv: o }))} onSave={saveInv} />
      <SalaryModal open={modals.salary} onOpenChange={o => setModals(m => ({ ...m, salary: o }))} onSave={saveSalary} wallets={wallets} categories={categories} />
      <AptExpenseModal open={modals.apt} onOpenChange={o => setModals(m => ({ ...m, apt: o }))} onSave={saveApt} categories={categories} config={aptConfig} />
    </div>
  )
}
