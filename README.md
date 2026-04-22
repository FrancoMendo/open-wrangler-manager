# Wrangler Manager

**Interfaz de escritorio para gestionar proyectos de Cloudflare Workers desde un solo lugar.**

Wrangler Manager escanea recursivamente un directorio local en busca de archivos `wrangler.toml` y `wrangler.jsonc`, y presenta cada Worker como una tarjeta interactiva desde donde podés deployar, ver logs en tiempo real y ejecutar comandos, todo sin salir de la aplicación.

> **100 % local · Sin servidores · Sin telemetría · Código abierto**

---

## Funcionalidades

### Exploración de proyectos
- Seleccioná cualquier directorio raíz desde el selector nativo del sistema operativo.
- El backend en Rust recorre toda la jerarquía de carpetas (saltando `node_modules/`, `.git/` y `target/`) y detecta automáticamente cada `wrangler.toml` o `wrangler.jsonc`.
- Los Workers se agrupan en un árbol de carpetas que refleja la estructura real del disco.
- El último directorio usado se recuerda entre sesiones.

### Tarjetas de Worker
Cada Worker detectado muestra su nombre, ruta relativa y la lista de entornos definidos en su configuración. Desde la misma tarjeta podés:

- **Deploy** — ejecuta `npx wrangler deploy` para el Worker seleccionado, opcionalmente con `--env <entorno>`.
- **Logs en tiempo real** — ejecuta `npx wrangler tail` y transmite la salida al terminal integrado.  
  - Selector de formato: **pretty** (legible) o **JSON** (para parsear).
- **Selector de entorno** — menú desplegable que lista todos los entornos definidos en el archivo de configuración; el flag `--env` se agrega automáticamente.
- **Abrir en editor** — abre el archivo de configuración del Worker directamente en tu editor de código predeterminado.

### Búsqueda y filtrado
- Barra de búsqueda en el encabezado que filtra Workers por nombre o por nombre de entorno en tiempo real.

### Terminal integrado
- Terminal xterm.js incrustado en la parte inferior de la ventana, con tema oscuro y fuente monospace.
- **Redimensionable**: arrastrá el borde superior para ajustar la altura (entre 120 px y 600 px).
- **Selector de shell**: elegí entre PowerShell o CMD; la preferencia se guarda entre sesiones.
- **Búsqueda en output**: `Ctrl+F` abre un buscador con navegación hacia adelante y atrás sobre el texto del terminal.
- **Limpiar output**: botón para resetear el contenido del terminal.
- **Detener proceso**: botón rojo que aparece mientras hay un proceso activo; lo termina inmediatamente.

### Estado de autenticación con Cloudflare
- Al iniciar, la app ejecuta `wrangler whoami` para detectar si hay una sesión activa.
- Si estás autenticado, se muestra tu email en el encabezado.
- Si no lo estás, aparece un botón **Disconnected** que ejecuta `wrangler login` con un clic.
- Mientras no hay sesión, la app reintenta la verificación automáticamente cada 30 segundos.
- También se detecta y muestra la versión de Wrangler instalada en el sistema.

### Recarga manual
- Botón de refresh que re-escanea el directorio actual sin necesidad de volver a seleccionarlo.

---

## Seguridad

Wrangler Manager está diseñado para correr **exclusivamente en tu máquina**. No hay ningún componente remoto involucrado:

| Aspecto | Detalle |
|---|---|
| **Sin servidor** | La aplicación es un ejecutable de escritorio (Tauri). No hay backend en la nube ni API propia. |
| **Sin telemetría** | No se recopilan métricas, eventos de uso ni información del sistema. |
| **Sin almacenamiento remoto** | El único dato persistido es el último directorio usado y la preferencia de shell, guardados en `localStorage` del WebView local. |
| **Credenciales de Cloudflare intactas** | La autenticación la maneja el propio CLI de Wrangler usando su store nativo (`~/.wrangler`). La app nunca lee ni almacena tokens. |
| **Comandos ejecutados localmente** | Todo corre a través del plugin `shell` de Tauri, que lanza procesos del sistema operativo en tu máquina. Ningún comando sale a internet por cuenta de la app. |
| **Código auditableble** | Al ser de código abierto podés revisar exactamente qué hace cada parte del sistema. |

En resumen: la app es solo una interfaz gráfica sobre el CLI de Wrangler. Si confiás en Wrangler, podés confiar en esta app.

---

## Requisitos

- [Node.js](https://nodejs.org/) ≥ 18 con `npx` disponible en PATH
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) instalado globalmente o disponible vía `npx`
- [Rust](https://rustup.rs/) (solo para compilar desde el código fuente)
- Sistema operativo: Windows 10/11, macOS o Linux

---

## Instalación

### Desde el código fuente

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/open-wrangler-manager.git
cd open-wrangler-manager

# 2. Instalar dependencias de Node
npm install

# 3. Iniciar en modo desarrollo (Vite + ventana Tauri)
npx tauri dev

# 4. O compilar el ejecutable de producción
npx tauri build
```

El ejecutable final queda en `src-tauri/target/release/`.

---

## Uso básico

1. **Abrí la app** — al iniciar detecta automáticamente si ya tenés una sesión de Cloudflare activa.
2. **Seleccioná un directorio** — hacé clic en **Open Folder** y elegí la carpeta raíz donde tenés tus proyectos de Workers.
3. **Explorá tus Workers** — la app muestra todas las configuraciones encontradas agrupadas por carpeta.
4. **Operá desde la tarjeta** — seleccioná un entorno, elegí el formato de logs y usá los botones de Deploy o Logs.
5. **Revisá el output** — el terminal en la parte inferior muestra la salida en tiempo real. Podés buscarlo con `Ctrl+F`, limpiarlo o detener el proceso con el botón rojo.

---

## Tecnologías

| Capa | Stack |
|---|---|
| Interfaz | React 19, TypeScript 5.8, Tailwind CSS 3 |
| Terminal | xterm.js 6 |
| Bundler | Vite 7 |
| Escritorio | Tauri 2.x (backend Rust + WebView nativo) |
| Crates de Rust | `walkdir`, `toml`, `json5`, `serde_json`, plugins de Tauri |

---

## Licencia

MIT — libre para usar, modificar y distribuir.
