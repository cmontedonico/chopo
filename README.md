# Chopo Health

Plataforma web para la gestión, visualización y análisis de resultados de estudios de laboratorio clínico. Permite a los pacientes subir sus estudios de sangre, consultar resultados históricos con gráficas interactivas y obtener correlaciones clínicas entre sus valores, perfil de salud y factores de riesgo.

## Descripción del servicio

Chopo Health digitaliza la experiencia del paciente con sus resultados de laboratorio:

- **Dashboard médico** — Visualización de hasta 40 elementos de una química sanguínea (glucosa, colesterol, hemoglobina, función hepática, renal, tiroidea, electrolitos, vitaminas, marcadores inflamatorios, etc.) con indicadores de estado, gráficas comparativas contra valores de referencia e historial por estudio.
- **Carga de resultados** — Los pacientes suben sus estudios en formato PDF o imagen. El sistema extrae los valores automáticamente y los integra al historial.
- **Correlaciones clínicas** — Análisis cruzado entre resultados de laboratorio, edad, sexo, IMC y condiciones preexistentes para identificar factores de riesgo cardiovascular, metabólico, hepático, renal y otros, con recomendaciones personalizadas.
- **Autenticación** — Registro, inicio de sesión y recuperación de contraseña.

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | [Bun](https://bun.sh) 1.2.18 |
| Monorepo | [Turborepo](https://turbo.build) 2.8.12 |
| Backend / DB | [Convex](https://convex.dev) 1.32.0 (serverless + base de datos en tiempo real) |
| Auth | [Better-Auth](https://better-auth.com) 1.4.9 + @convex-dev/better-auth |
| Frontend | [React](https://react.dev) 19 + [Vite](https://vite.dev) + [TanStack Router](https://tanstack.com/router) |
| Componentes UI | [shadcn/ui](https://ui.shadcn.com) (base-lyra) + [Tailwind CSS](https://tailwindcss.com) 4.1.18 |
| Gráficas | [Recharts](https://recharts.org) 2.x |
| Linting | [Oxlint](https://oxc.rs) + Oxfmt |
| Testing | [Vitest](https://vitest.dev) (unit) + [Playwright](https://playwright.dev) (E2E) |
| Deployment | [Vercel](https://vercel.com) (frontend) + [Convex Cloud](https://convex.dev) (backend) |

## Estructura del monorepo

```
chopo-v1/
├── apps/
│   ├── web/                    # App principal — React 19 + Vite (puerto 3001)
│   └── fumadocs/               # Documentación — Next.js (puerto 4000)
├── packages/
│   ├── backend/                # Convex — schema, funciones, auth
│   ├── ui/                     # Librería de componentes compartidos (shadcn/ui)
│   ├── env/                    # Variables de entorno tipadas (@t3-oss/env-core)
│   └── config/                 # Configuración base de TypeScript
```

## Requisitos previos

- [Bun](https://bun.sh) >= 1.2.18
- [Node.js](https://nodejs.org) >= 20 (requerido por algunas dependencias)
- Cuenta en [Convex](https://convex.dev) (para el backend)

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd chopo

# Instalar dependencias
bun install
```

## Configuración de entorno

Crea el archivo `apps/web/.env` con las variables necesarias:

```env
VITE_CONVEX_URL=<tu-convex-deployment-url>
VITE_CONVEX_SITE_URL=<tu-convex-site-url>
```

Para configurar el backend de Convex por primera vez:

```bash
bun dev:setup
```

## Desarrollo

```bash
# Iniciar todo (frontend + backend)
bun dev

# Solo frontend (puerto 3001)
bun dev:web

# Solo backend (Convex)
bun dev:server
```

Abre [http://localhost:3001](http://localhost:3001) en tu navegador.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `bun dev` | Inicia todas las apps en modo desarrollo |
| `bun dev:web` | Inicia solo la app web (puerto 3001) |
| `bun dev:server` | Inicia solo el backend Convex |
| `bun build` | Build de producción de todos los paquetes |
| `bun check-types` | Verificación de tipos TypeScript |
| `bun check` | Linting (Oxlint) + formateo (Oxfmt) |

## Rutas de la aplicación

| Ruta | Descripción |
|------|-------------|
| `/login` | Inicio de sesión |
| `/signup` | Crear cuenta |
| `/reset-password` | Restablecer contraseña |
| `/app` | Dashboard — resultados de química sanguínea |
| `/app/upload` | Subir estudios de laboratorio |
| `/app/correlations` | Correlaciones clínicas y factores de riesgo |

## Licencia

Proyecto privado. Todos los derechos reservados.
