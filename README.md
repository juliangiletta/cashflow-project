# 💰 Mi Cash Flow

Aplicación de gestión de finanzas personales con seguimiento de inversiones, controles médicos y gastos compartidos.

## 🚀 Configuración Paso a Paso

### Paso 1: Crear proyecto en Supabase

1. Andá a [https://supabase.com](https://supabase.com) y creá una cuenta (gratis)
2. Click en **"New Project"**
3. Completá:
   - **Name:** `cashflow` (o el nombre que quieras)
   - **Database Password:** generá una contraseña segura y guardala
   - **Region:** South America (São Paulo) - o la más cercana
4. Click en **"Create new project"**
5. Esperá ~2 minutos mientras se crea

### Paso 2: Crear las tablas en la base de datos

1. En el Dashboard de Supabase, andá a **SQL Editor** (menú izquierdo)
2. Click en **"New Query"**
3. Copiá TODO el contenido del archivo `database/schema.sql`
4. Pegalo en el editor
5. Click en **"Run"** (o Ctrl+Enter)
6. Deberías ver "Success. No rows returned" - esto está bien

### Paso 3: Crear el Storage para archivos médicos

1. En Supabase, andá a **Storage** (menú izquierdo)
2. Click en **"New bucket"**
3. Nombre: `medical-files`
4. Marcá **"Public bucket"** (para poder ver los archivos)
5. Click en **"Create bucket"**

### Paso 4: Obtener las credenciales de API

1. En Supabase, andá a **Settings** > **API** (menú izquierdo)
2. Copiá estos valores:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public** key (la key larga que empieza con `eyJ...`)

### Paso 5: Configurar el proyecto local

1. Asegurate de tener [Node.js](https://nodejs.org/) instalado (versión 18+)

2. Abrí una terminal y navegá a la carpeta del proyecto:
   ```bash
   cd cashflow-project
   ```

3. Instalá las dependencias:
   ```bash
   npm install
   ```

4. Creá el archivo de configuración:
   ```bash
   cp .env.example .env
   ```

5. Editá el archivo `.env` con tus credenciales de Supabase:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Paso 6: Ejecutar la aplicación

```bash
npm run dev
```

La aplicación estará disponible en: **http://localhost:5173**

Para acceder desde tu celular en la misma red WiFi, usá la IP que muestra la terminal (algo como `http://192.168.1.xxx:5173`)

---

## 📱 Funcionalidades

### Dashboard
- Balance total de todas las billeteras
- Resumen de portfolio de inversiones
- Ingresos y egresos del mes
- Gráfico de composición del portfolio
- Últimos movimientos

### Movimientos
- Filtro por mes
- Resumen mensual (ingresos, egresos, balance)
- Lista de transacciones con categoría y billetera
- Agregar ingresos, egresos e inversiones

### Inversiones
- Lista de tenencias actuales
- Precio promedio y cantidad por activo
- Rendimiento porcentual
- **Auto-cálculo de precio promedio** al comprar

### Controles Médicos
- Gráfico de evolución de peso
- Alertas de controles pendientes
- Historial de controles con comentarios
- Upload de archivos (resultados, pedidos)

### Gastos Departamento
- Total mensual
- División automática por porcentaje
- Lista de gastos fijos

---

## 🛠️ Estructura del Proyecto

```
cashflow-project/
├── database/
│   └── schema.sql        # Esquema de base de datos
├── src/
│   ├── lib/
│   │   └── supabase.js   # Cliente y funciones de BD
│   ├── App.jsx           # Componente principal
│   ├── main.jsx          # Entry point
│   └── index.css         # Estilos Tailwind
├── .env.example          # Template de configuración
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## 📝 Próximos Pasos Sugeridos

1. **Cargar datos iniciales:** Actualizar los balances de tus billeteras
2. **Importar historial:** Si querés migrar datos del Excel, podés hacerlo directamente en Supabase (Table Editor)
3. **Personalizar categorías:** Agregar/modificar categorías en la tabla `categories`
4. **Agregar más billeteras:** En la tabla `wallets`

---

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

---

## 🐛 Troubleshooting

### "Error de conexión"
- Verificá que las credenciales en `.env` sean correctas
- Asegurate de que el proyecto de Supabase esté activo

### "No hay datos"
- Verificá que el script SQL se ejecutó correctamente
- Revisá en Supabase > Table Editor si las tablas existen

### No puedo subir archivos
- Verificá que el bucket `medical-files` existe y es público

---

## 📄 Licencia

MIT - Usalo como quieras!


src/
├── components/
│   └── ui/
│       ├── button.jsx
│       ├── card.jsx
│       ├── dialog.jsx
│       ├── input.jsx
│       ├── label.jsx
│       ├── select.jsx
│       ├── tabs.jsx
│       ├── badge.jsx
│       ├── progress.jsx
│       ├── separator.jsx
│       ├── scroll-area.jsx
│       ├── dropdown-menu.jsx
│       └── toast.jsx
├── lib/
│   ├── supabase.js
│   └── utils.js
├── App.jsx
├── index.css
└── main.jsx