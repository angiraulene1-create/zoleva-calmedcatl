# ◈ Zoleva Calmécatl

[![License: MIT](https://img.shields.io/badge/License-MIT-%23c9a24a)](LICENSE)
[![Node.js ≥ 18](https://img.shields.io/badge/Node.js-%E2%89%A518-3fcf9e)](https://nodejs.org)
[![Sin dependencias](https://img.shields.io/badge/dependencies-0-6f7f6b)](package.json)

**Escuela de élite mexica · código abierto · gratis para siempre.**

Zoleva Calmécatl toma su nombre del náhuatl: *escuela de élite mexica*. El antiguo *calmecac* formaba a la élite con disciplina, memoria y dominio de las artes. Nosotros recuperamos esa idea —aprender con rigor— y la ponemos al alcance de cualquiera, sin puertas cerradas ni pagos.

Es una app de estudio que convierte tus apuntes en un **plan de examen, lecciones, tarjetas con repetición espaciada, cuestionarios, simulacros y un tutor IA** que te guía con pistas en vez de darte la respuesta.

> Repositorio: <https://github.com/angiraulene1-create/zoleva-calmedcatl>

## ¿Por qué existe?

Porque preparar un examen no debería exigir una suscripción, una cuenta ni entregar tus apuntes a una empresa. Aquí:

- **No hay cuenta, ni pago, ni anuncios, ni telemetría.**
- Tus datos se quedan en tu navegador; la configuración de IA, en tu equipo.
- Puedes usar **IA local sin internet** o elegir entre proveedores gratuitos y CLIs que ya tengas.
- Si un proveedor falla, el **modo demo** sigue generando material de estudio a partir de tu texto.

## Funciones

- **Página de presentación** con el origen del nombre, funciones y preguntas frecuentes.
- **App web PWA** instalable en móvil y escritorio.
- **Plan de examen**: fecha, asignatura, prioridades, temas y seguimiento.
- **Tutor IA**: modo socrático (pistas), resolución paso a paso y explicación. Acepta fotos de ejercicios con modelos con visión.
- **Tarjetas de memoria** con programación espaciada tipo SM-2: otra vez / difícil / bien / fácil.
- **Cuestionarios corregidos** con explicación por respuesta.
- **Simulacros con temporizador**: preguntas objetivas y desarrolladas con rúbrica.
- **Guion de podcast** de dos voces sobre tus materiales.
- **Materiales**: pega texto o sube `.txt`, `.md`, `.json` e imágenes.
- **Progreso**: racha, minutos diarios, dominio por tema e historial de aciertos.
- **Exportar / importar** tus datos en JSON y borrado total.

## IA intercambiable

| Proveedor | Coste | Clave | Notas |
| --- | --- | --- | --- |
| Demo | Gratis | No | Genera ejemplos a partir de tu texto, sin red |
| Ollama | Gratis | No | Offline. `ollama pull llama3.2` (visión: `llama3.2-vision`) |
| LM Studio / llama.cpp | Gratis | No | Cualquier endpoint OpenAI-compatible |
| OpenRouter | Gratis\* | Sí | Modelos con sufijo `:free` |
| Google Gemini | Gratis\* | Sí | Capa gratuita de la API |
| Groq | Gratis\* | Sí | Capa gratuita de la API |
| OpenCode CLI | Según tu sesión | No | `opencode run --format json` |
| Codex CLI | Según tu sesión | No | `codex exec --json` |
| Claude CLI | Suscripción | No | `claude -p --output-format json` |
| Gemini CLI | Según tu sesión | No | `gemini -p --output-format json` |
| Comando propio | Lo que quieras | No | Cualquier CLI: `mi-ia "{prompt}"` |

\* Según los límites de cada proveedor.

En **Ajustes → Proveedor de IA** cambias de proveedor, eliges modelo, pegas claves, pruebas la conexión y consultas los modelos disponibles. Las claves se guardan en `.data/config.json` (permisos `0600`) y solo se envían al proveedor seleccionado.

## Inicio rápido

Requiere **Node.js 18 o superior**. No hay `npm install`: usa solo módulos incluidos en Node.

```bash
git clone https://github.com/angiraulene1-create/zoleva-calmedcatl.git
cd zoleva-calmedcatl
npm start
```

Abre <http://127.0.0.1:3000>. Para usarla desde el móvil en la misma red:

```bash
HOST=0.0.0.0 PORT=3000 npm start
```

### IA local con Ollama

```bash
ollama serve
ollama pull llama3.2
```

Después, en Ajustes, selecciona **Ollama (local)** y el modelo `llama3.2`. Para fotos de ejercicios usa `llama3.2-vision`.

### CLIs

Detecta automáticamente los CLIs instalados y disponibles. Para cualquier otro, escribe un comando con el marcador `{prompt}`:

```bash
mi-ia --json "{prompt}"
```

El prompt se pasa entre comillas simples de forma segura. Si el comando no usa `{prompt}`, se lo envía por stdin.

## Instalar como app (PWA)

En el navegador: **Menú → Instalar aplicación**. En Android e iOS: **Añadir a pantalla de inicio**. Puedes consultar tus datos sin conexión; la IA local necesita Ollama en marcha en la misma red.

## Estructura

```
zoleva-calmedcatl/
├── server.js                 servidor HTTP y rutas /api
├── src/
│   ├── prompts.js            prompts y normalización de respuestas JSON
│   ├── providers.js          Ollama, OpenAI-compatible, Gemini, CLIs…
│   └── demo.js               generador sin IA
├── public/
│   ├── index.html            landing + app
│   ├── app.js                estado, vistas y acciones (localStorage)
│   ├── styles.css            identidad visual obsidiana / jade / oro
│   ├── sw.js                 service worker
│   ├── manifest.webmanifest
│   └── icon.svg              greca mexica
└── tests/core.test.mjs
```

## Pruebas

```bash
npm test
```

## Contribuir

1. Haz un fork del repositorio.
2. Crea una rama: `git checkout -b mi-mejora`.
3. Añade cambios y pruebas: `npm test`.
4. Abre un *pull request* describiendo qué mejoraste.

Las ideas bienvenidas: lectura de PDFs, más proveedores, traducción al náhuatl/inglés, temas visuales adicionales y empaquetado móvil/de escritorio.

## Identidad visual

Obsidiana como fondo, **jade** para el dominio del conocimiento y **oro** para la disciplina y la excelencia; la greca escalonada del emblema evoca los templos y el calmecac. Tipografía: *Cinzel* para los títulos e *Inter* para el texto.

## Límites conocidos (MVP)

- Los PDFs no se leen directamente: copia el texto o sube una imagen de la página.
- Las imágenes se guardan en `localStorage`; mantenlas pequeñas (≤ 2 MB).
- La generación no hace streaming token a token: muestra «pensando» y después la respuesta completa.
- El simulacro corrige automáticamente las objetivas; las desarrolladas muestran la rúbrica y puedes pedirle al tutor que las corrija.
- No hay cuentas ni sincronización: exporta e importa el JSON para mover tus datos.

## Licencia

MIT. Úsalo, estúdialo, cámbialo y compártelo. El conocimiento, como en el calmecac, se multiplica cuando se enseña.
