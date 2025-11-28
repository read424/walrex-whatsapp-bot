# 🤖 WhatsApp Bot - Walrex

> Bot inteligente de WhatsApp con arquitectura hexagonal para automatizar operaciones financieras y atención al cliente.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Architecture](https://img.shields.io/badge/Architecture-Hexagonal-blue.svg)](<https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)>)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Tabla de Contenidos

- [🚀 Características](#-características)
- [🏗️ Arquitectura](#️-arquitectura)
- [📦 Tecnologías](#-tecnologías)
- [⚙️ Instalación](#️-instalación)
- [🔧 Configuración](#-configuración)
- [🚀 Uso](#-uso)
- [📁 Estructura del Proyecto](#-estructura-del-proyecto)
- [🔌 APIs y Endpoints](#-apis-y-endpoints)
- [📊 Logging y Monitoreo](#-logging-y-monitoreo)
- [🧪 Testing](#-testing)
- [🤝 Contribución](#-contribución)
- [📄 Licencia](#-licencia)

## 🚀 Características

### ✨ Funcionalidades Principales

- **🤖 Bot de WhatsApp Automatizado**: Integración con WhatsApp Web.js y Venom Bot
- **💸 Gestión de Remesas**: Procesamiento automático de envíos de dinero
- **📊 Consulta de Estatus**: Seguimiento de operaciones en tiempo real
- **📝 Sistema de Reclamos**: Gestión automatizada de reclamos
- **💱 Consulta de Tasas**: Información actualizada de tipos de cambio
- **🏦 Información Bancaria**: Datos de cuentas bancarias
- **🧮 Calculadora**: Herramientas de cálculo financiero
- **👤 Registro de Usuarios**: Sistema de registro y autenticación

### 🎯 Características Técnicas

- **🏛️ Arquitectura Hexagonal**: Separación clara de responsabilidades
- **📱 Multi-Strategy**: Soporte para WhatsApp Web.js y Venom Bot
- **🔒 Gestión de Sesiones**: Persistencia de sesiones de usuario
- **⚡ Caching Inteligente**: Optimización de rendimiento
- **📊 Logging Estructurado**: Trazabilidad completa con correlation IDs
- **🔄 WebSocket**: Comunicación en tiempo real
- **📈 Métricas de Performance**: Monitoreo de rendimiento

## 🏗️ Arquitectura

### 📐 Patrón Hexagonal (Ports & Adapters)

```
src/
├── domain/                 # 🎯 Núcleo de Negocio
│   ├── model/             # Entidades de dominio
│   ├── service/           # Servicios de dominio
│   └── constants/         # Constantes del negocio
├── application/           # 🔧 Casos de Uso
│   ├── services/          # Servicios de aplicación
│   ├── usecases/          # Casos de uso específicos
│   └── ports/             # Puertos (interfaces)
│       ├── input/         # Puertos de entrada
│       └── output/        # Puertos de salida
└── infrastructure/        # 🌐 Adaptadores Externos
    ├── adapters/          # Implementaciones
    │   ├── inbound/       # Controladores, Handlers
    │   └── outbound/      # Repositorios, APIs externas
    └── config/            # Configuraciones
```

### 🔄 Flujo de Datos

1. **Input**: Mensaje de WhatsApp → Handler → Use Case
2. **Domain**: Lógica de negocio → Domain Service
3. **Output**: Repository → Database/External API
4. **Response**: Use Case → Handler → WhatsApp Client

## 📦 Tecnologías

### 🛠️ Core Technologies

- **Node.js** (v18+) - Runtime de JavaScript
- **Express.js** - Framework web
- **Sequelize** - ORM para base de datos
- **MySQL/PostgreSQL** - Base de datos relacional

### 🤖 WhatsApp Libraries

- **whatsapp-web.js** - Librería principal de WhatsApp
- **venom-bot** - Librería alternativa
- **Puppeteer** - Automatización de navegador

### 🏗️ Arquitectura & Patrones

- **Arquitectura Hexagonal** - Separación de responsabilidades
- **Strategy Pattern** - Múltiples estrategias de WhatsApp
- **Singleton Pattern** - Gestión de instancias únicas
- **Repository Pattern** - Acceso a datos
- **Factory Pattern** - Creación de objetos

### 📊 Monitoreo & Logging

- **Winston** - Sistema de logging estructurado
- **WebSocket** - Comunicación en tiempo real
- **Cache Manager** - Caching en memoria

## ⚙️ Instalación

### 📋 Prerrequisitos

- Node.js 18 o superior
- npm o yarn
- MySQL/PostgreSQL
- Git

### 🔧 Pasos de Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/tu-usuario/bot-walrexapp.git
cd bot-walrexapp
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. **Configurar base de datos**

```bash
npm run migrate
```

5. **Iniciar en desarrollo**

```bash
npm run start:dev
```

## 🔧 Configuración

### 📝 Variables de Entorno

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=walrex_bot
DB_USER=root
DB_PASSWORD=password

# WhatsApp Configuration
WHATSAPP_LIBRARY=whatsapp-web.js
WHATSAPP_SESSION_PATH=./session-whatsappweb

# Server
PORT=3330
NODE_ENV=development

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./src/logs

# Cache
CACHE_TTL=600000
```

### 🗄️ Base de Datos

El proyecto incluye migraciones automáticas para crear las tablas necesarias:

```bash
# Ejecutar migraciones
npm run migrate

# Revertir migraciones (si es necesario)
npm run migrate:undo
```

## 🚀 Uso

### 🏃‍♂️ Iniciar el Bot

```bash
# Desarrollo (con nodemon)
npm run start:dev

# Producción
npm start

# Solo verificar sintaxis
npm run lint
```

### 📱 Conectar WhatsApp

1. **Iniciar el servidor**
2. **Abrir**: `http://localhost:3330/qr`
3. **Escanear QR** con tu WhatsApp
4. **¡Listo!** El bot está conectado

### 🤖 Comandos del Bot

| Comando | Descripción          |
| ------- | -------------------- |
| `1`     | Envío de Remesa 💸   |
| `2`     | Estatus Operación 📁 |
| `3`     | Reclamo 📝           |
| `4`     | Tasas 💱             |
| `5`     | Cuentas Bancarias 🏦 |
| `6`     | Calculadora 🧮       |
| `7`     | Registrarse 👤       |

## 📁 Estructura del Proyecto

```
bot-walrexapp/
├── src/
│   ├── domain/                    # 🎯 Núcleo de negocio
│   │   ├── model/                # Entidades de dominio
│   │   ├── service/              # Servicios de dominio
│   │   └── constants/            # Constantes
│   ├── application/              # 🔧 Casos de uso
│   │   ├── services/             # Servicios de aplicación
│   │   ├── usecases/             # Casos de uso específicos
│   │   └── ports/                # Puertos (interfaces)
│   ├── infrastructure/           # 🌐 Adaptadores
│   │   ├── adapters/             # Implementaciones
│   │   │   ├── inbound/          # Controladores
│   │   │   └── outbound/         # Repositorios
│   │   └── config/               # Configuraciones
│   └── py-script/                # 🐍 Scripts Python (OCR, etc.)
├── docs/                         # 📚 Documentación técnica
│   └── INDEX.md                  # Índice de documentación
├── models/                       # Modelos Sequelize
├── migrations/                   # Migraciones de BD
├── public/                       # Archivos estáticos
└── logs/                         # Archivos de log
```

## 📚 Documentación

Toda la documentación técnica del proyecto está organizada en la carpeta [`docs/`](./docs/).

### Acceso rápido:
- **📖 [Índice de Documentación](./docs/INDEX.md)** - Índice completo organizado por categorías
- **🏗️ Arquitectura Hexagonal** - Guías y auditorías de arquitectura
- **📸 Integración con Instagram** - Configuración de RapidAPI y OCR
- **🔧 Refactorizaciones** - Historial de cambios y mejoras
- **🐛 Correcciones** - Documentación de fixes específicos

**Ver todas**: [`docs/INDEX.md`](./docs/INDEX.md)

## 🔌 APIs y Endpoints

### 📊 Health Check

```http
GET /health
```

### 🔐 WhatsApp QR Code

```http
GET /qr
```

### 📱 WhatsApp Status

```http
GET /status
```

### ⌨️ Typing Indicator

```http
POST /typing
Content-Type: application/json

{
  "phoneNumber": "51913061289",
  "duration": 2000
}
```

### 🗄️ Cache Management

```http
GET /cache/stats
GET /cache/keys
DELETE /cache/clear
```

### 📊 Logs

```http
GET /logs/levels
```

## 📊 Logging y Monitoreo

### 📝 Logging Estructurado

El sistema utiliza Winston para logging estructurado con:

- **Correlation IDs**: Trazabilidad de requests
- **Niveles de log**: error, warn, info, debug
- **Rotación automática**: Archivos diarios
- **Formato JSON**: Fácil parsing

### 📈 Métricas de Performance

```javascript
// Ejemplo de métrica
structuredLogger.performance("ServiceName", "operation", duration, {
  additionalData: "value",
});
```

### 🔍 Monitoreo en Tiempo Real

- **WebSocket**: Estado del bot en tiempo real
- **Health Checks**: Estado de servicios
- **Cache Stats**: Estadísticas de caché

## 🧪 Testing

### 🧪 Tests Unitarios

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

### 🔄 Tests de Integración

```bash
# Tests de integración
npm run test:integration

# Tests de API
npm run test:api
```

## 🤝 Contribución

### 📋 Guías de Contribución

1. **Fork** el proyecto
2. **Crea** una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'feat: add amazing feature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. **Abre** un Pull Request

### 📝 Conventional Commits

Seguimos el estándar [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: nueva funcionalidad
fix: corrección de bug
docs: cambios en documentación
style: cambios de formato
refactor: refactorización
test: agregar tests
chore: cambios en build
```

### 🏗️ Arquitectura

Al contribuir, mantén los principios de arquitectura hexagonal:

- **Domain**: Sin dependencias externas
- **Application**: Solo depende de domain
- **Infrastructure**: Implementa los puertos

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Autores

- **Tu Nombre** - _Desarrollo inicial_ - [TuUsuario](https://github.com/TuUsuario)

## 🙏 Agradecimientos

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - Librería de WhatsApp
- [venom-bot](https://github.com/orkestral/venom) - Librería alternativa
- [Express.js](https://expressjs.com/) - Framework web
- [Sequelize](https://sequelize.org/) - ORM

---

⭐ **¿Te gustó el proyecto? ¡Dale una estrella!**
