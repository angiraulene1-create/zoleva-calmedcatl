# ✦ Lumi · Estudio Libre

Tutor de estudio **libre, gratuito y local-first** inspirado en apps de preparación de exámenes como Astra AI. Convierte tus apuntes en un plan, lecciones, tarjetas con repetición espaciada, cuestionarios, simulacros y un tutor que te guía con pistas.

No hay cuenta, ni pago, ni telemetría. Tu progreso se guarda en tu navegador y la configuración de IA en un archivo de tu equipo.

## Qué incluye

- **Página de presentación** con funciones, funcionamiento y preguntas frecuentes.
- **App web PWA** instalable en móvil y escritorio.
- **Plan de examen** a partir de tus materiales, con fecha, prioridades y seguimiento.
- **Tutor IA** en tres modos: socrático (pistas), resolver paso a paso y explicar. Acepta fotos de ejercicios con proveedores con visión.
- **Tarjetas de memoria** con programación espaciada tipo SM-2 (otra vez / difícil / bien / fácil).
- **Cuestionarios corregidos** con explicación por respuesta.
- **Simulacros con temporizador**, preguntas objetivas y desarrolladas con rúbrica.
- **Podcast** en forma de guion de dos voces.
- **Materiales**: pega texto, sube `.txt`, `.md`, `.json` o imágenes.
- **Progreso**: racha, minutos diarios, dominio por tema e historial de aciertos.
- **Exportar / importar** tus datos en JSON y borrado total.
- **Modo demo sin IA** para usar la app sin instalar ni configurar nada.

## IA intercambiable

| Proveedor | Coste | Clave | Notas |
| --- | --- | --- | --- |
| Demo | Gratis | No | Genera ejemplos a partir de tu texto, sin red |
| Ollama | Gratis | No | Offline. `ollama pull llama3.2` (visión: `llama3.2-vision`) |
| LM Studio / llama.cpp | Gratis | No | Cualquier endpoint OpenAI-compatible |
| OpenRouter | Gratis* | Sí | Modelos con sufijo `:free` |
| Google Gemini | Gratis* | Sí | Capa gratuita de la API |
| Groq | Gratis* | Sí | Capa gratuita de la API |
| OpenCode CLI | Según tu sesión | No | `opencode run --format json` |
| Codex CLI | Según tu sesión | No | `codex exec --json` |
| Claude CLI | Suscripción | No | `claude -p --output-format json` |
| Gemini CLI | Según tu sesión | No | `gemini -p --output-format json` |
| Comando propio | Lo que quieras | No | Cualquier CLI: `mi-ia "{prompt}"` |

\* Según los límites del proveedor.

En **Ajustes → Proveedor de IA** puedes cambiar de proveedor, elegir modelo, pegar claves, probar la conexión y ver los modelos disponibles. Si un proveedor falla al generar JSON, Lumi avisa y usa el modo demo para que puedas seguir estudiando.

## Puesta en marcha

Requiere **Node.js 18 o superior**.

```bash
cd Proyectos/estudio-libre
npm start
```

Abre <http://127.0.0.1:3000>. Para escuchar en la red local (por ejemplo, desde el móvil):

```bash
HOST=0.0.0.0 PORT=3000 npm start
```

No hay `npm install`: el proyecto usa solo módulos incluidos en Node.

### IA local con Ollama

```bash
ollama serve
ollama pull llama3.2
```

Después, en Ajustes, selecciona **Ollama (local)** y el modelo `llama3.2`. Para adjuntar fotos, usa un modelo con visión como `llama3.2-vision`.

### Proveedores en la nube

Consigue una clave gratuita en OpenRouter, Google AI Studio o Groq, pégala en Ajustes y elige el modelo. Las claves se guardan en `.data/config.json` (permisos `0600`) y solo se envían al proveedor seleccionado.

### CLIs

Detecta automáticamente los CLIs instalados y disponibles. Selecciona el que quieras en Ajustes. Para cualquier otro, escribe un comando con el marcador `{prompt}`, por ejemplo:

```bash
mi-ia --json "{prompt}"
```

El prompt se pasa entre comillas simples de forma segura. Si tu comando no usa `{prompt}`, Lumi se lo envía por stdin.

## Instalar como app (PWA)

En el navegador: **Menú → Instalar aplicación**. En Android e iOS también desde **Añadir a pantalla de inicio**. La app funciona sin conexión para consultar tus datos; la IA local necesita que Ollama esté en marcha en la misma red.

## Estructura

```
estudio-libre/
├── server.js              servidor HTTP y rutas /api
├── src/
│   ├── prompts.js         prompts y normalización de respuestas JSON
│   ├── providers.js       proveedores: Ollama, OpenAI-compatible, Gemini, CLIs…
│   └── demo.js            generador sin IA
├── public/
│   ├── index.html         landing + app
│   ├── app.js             estado, vistas y acciones (localStorage)
│   ├── styles.css
│   ├── sw.js              service worker
│   └── manifest.webmanifest
└── tests/core.test.mjs
```

## Pruebas

```bash
npm test
```

## Límites conocidos (MVP)

- Los PDFs no se leen directamente: copia el texto o sube una imagen de la página.
- Las imágenes se guardan en `localStorage`; mantenlas pequeñas (≤ 2 MB) para no agotar la cuota del navegador.
- La generación no se transmite token a token: se muestra un indicador de “pensando” y aparece la respuesta completa.
- El simulacro corrige automáticamente las preguntas objetivas; las desarrolladas muestran la rúbrica y puedes pedirle al tutor que las corrija.
- No hay cuentas ni sincronización entre dispositivos: exporta e importa el JSON para mover tus datos.

## Licencia

MIT. Haz un fork, cambia el nombre, añade proveedores o tradúcelo: el código es tuyo también.
