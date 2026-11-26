# ◈ Zoleva Calmécatl

[![License: MIT](https://img.shields.io/badge/License-MIT-%23c9a24a)](LICENSE)
[![Node.js ≥ 18](https://img.shields.io/badge/Node.js-%E2%89%A518-3fcf9e)](https://nodejs.org)
[![Sin dependencias](https://img.shields.io/badge/dependencies-0-6f7f6b)](package.json)

**Escuela de élite mexica · código abierto · gratis para siempre.**

Zoleva Calmécatl toma su nombre del náhuatl: *escuela de élite mexica*. El antiguo *calmecac* formaba a la élite con disciplina, memoria y dominio de las artes. Nosotros recuperamos esa idea —aprender con rigor— y la ponemos al alcance de cualquiera, sin puertas cerradas ni pagos.

Es una app de estudio que convierte tus apuntes en un **plan de examen, lecciones, tarjetas con repetición espaciada, cuestionarios, simulacros y un tutor IA** que te guía con pistas en vez de darte la respuesta.

> Repositorio: <https://github.com/angiraulene1-create/zoleva-calmedcatl>

## ¿Por qué existe?

Porque preparar un examen no debería exigir una suscripción, un registro obligatorio ni entregar tus apuntes a una empresa. Aquí:

- **Tu cuenta es local al empezar: no hay pago, anuncios ni telemetría.**
- Tus datos se quedan en tu navegador; la configuración de IA y la nube opcional, en tu equipo.
- Puedes usar **IA local sin internet**, **IA en la nube** o los CLIs que ya tengas.
- Si quieres guardar tu progreso en la nube, tú pones la URL y el token: nada se sube automáticamente.
- Si un proveedor falla, el **modo demo** sigue generando material de estudio a partir de tu texto.

## Funciones

### Para estudiantes

- **Cuentas locales**: varias cuentas en el mismo equipo, cada una con sus cursos, chat, tarjetas y progreso. Sin registro obligatorio ni sincronización automática.
- **De kínder a doctorado**: kínder, primaria, secundaria, bachillerato, universidad, maestría y doctorado. El nivel ajusta el vocabulario, la extensión de los pasos y la duración sugerida de las sesiones.
- **Adaptación personal**: edad, estilo de aprendizaje (visual, auditivo, kinestésico, lector o mixto), tono (amable, juguetón o sobrio) y modo sin presión. La adaptación se envía al modelo en cada generación y chat.
- **Tutor 3D ligero y detallado**: ilustraciones SVG propias de **búho, lobo, águila, zorro y un maestro humano (Tlamatinime)**, con perspective CSS, flotación suave y capas de ropa/accesorios. No usa WebGL, funciona en móviles modestos y puede desactivarse en equipos lentos.
- **Tutor didáctico y menos estresante**: modos **Didáctico**, **Socrático**, **Sin presión**, **Juego**, **Resolver** y **Explicar**. Empieza por lo que ya sabes, divide los pasos y celebra el esfuerzo. Acepta fotos de ejercicios con modelos con visión.
- **Pausa guiada de respiración** de 4-4-6 y simulacros que pueden hacerse **sin temporizador**: practicar no tiene por qué ser un castigo.
- **Recompensas internas**: ganas ✦ puntos por estudiar, desbloqueas insignias y cambias de tutor —búho, lobo, águila, zorro o maestro— y de **accesorios** (penacho, gafas, amuleto, capa) y marcos de cuenta. Todo queda en tu equipo; no hay compras, clasificaciones ni competencia.
- **Foto de cuenta y avatar**: la foto se reduce a 160 px y se guarda solo en el navegador.
- **Respaldo en la nube opcional**: en **Mi cuenta** puedes poner tu propia URL y token, subir o bajar el respaldo cuando quieras. Sirve para dispositivos que no ejecutan IA local o para cambiar de equipo; nunca es automático.
- **Plan de examen**: fecha, asignatura, prioridades, temas y seguimiento.
- **Tarjetas de memoria** con programación espaciada tipo SM-2: otra vez / difícil / bien / fácil.
- **Cuestionarios corregidos** con explicación por respuesta.
- **Simulacros**: preguntas objetivas y desarrolladas con rúbrica, con o sin temporizador.
- **Guion de podcast** de dos voces sobre tus materiales.
- **Materiales**: pega texto o sube `.txt`, `.md`, `.json` e imágenes.
- **Progreso**: racha, minutos diarios, dominio por tema e historial de aciertos.

### Para docentes

- **Rol docente**: al activarlo aparece el panel **Docencia** con grupos guardados localmente.
- **Grupos y estudiantes**: crea grupos por nivel, añade nombres y guarda el material de la clase.
- **Guías didácticas, rúbricas y juegos de repaso** generados a partir del material y adaptados al nivel del grupo.
- **Seguimiento sin servidor**: importa el JSON que exporta cada estudiante y resume minutos, aciertos y dominio en una tabla local.

### Común

- **Página de presentación** con el origen del nombre, glosario náhuatl, niveles, funciones y preguntas frecuentes.
- **App web PWA** instalable en móvil y escritorio, con iconos PNG oficiales para Android, iOS y navegador.
- **Modo bilingüe Español / Náhuatl**: glosas de términos documentados (`calmecac`, `tlamatiliztli`, `ixtlamachiliztli`, `amoxcalli`…) en la navegación y los encabezados, sin sustituir las etiquetas funcionales.
- **Exportar / importar** tus datos en JSON, respaldo opcional en la nube y borrado total.

## IA intercambiable

| Proveedor | Coste | Clave | Notas |
| --- | --- | --- | --- |
| Demo | Gratis | No | Genera ejemplos a partir de tu texto, sin red |
| Ollama | Gratis | No | Offline. `ollama pull llama3.2` (visión: `llama3.2-vision`) |
| LM Studio / llama.cpp | Gratis | No | Cualquier endpoint OpenAI-compatible |
| OpenRouter | Gratis\* | Sí | Modelos `:free`; recomendado para equipos ligeros |
| Google Gemini | Gratis\* | Sí | Capa gratuita; buena opción en móviles |
| Groq | Gratis\* | Sí | Capa gratuita y respuestas rápidas |
| OpenCode CLI | Según tu sesión | No | `opencode run --format json` |
| Codex CLI | Según tu sesión | No | `codex exec --json` |
| Claude CLI | Suscripción | No | `claude -p --output-format json` |
| Gemini CLI | Según tu sesión | No | `gemini -p --output-format json` |
| Comando propio | Lo que quieras | No | Cualquier CLI: `mi-ia "{prompt}"` |

\* Según los límites de cada proveedor.

En **Ajustes → Proveedor de IA** cambias de proveedor, eliges modelo, pegas claves, pruebas la conexión y consultas los modelos disponibles. Si tu dispositivo no soporta IA local, elige **OpenRouter** o **Gemini**: la generación sucede en la nube y tu equipo solo muestra el resultado. Las claves se guardan en `.data/config.json` (permisos `0600`) y solo se envían al proveedor seleccionado.

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

### Primeros pasos

1. Entra en **Mi cuenta** y elige nombre, rol (estudiante o docente), edad, nivel, estilo de estudio y tono del tutor.
2. Crea un plan con tus apuntes. El tutor y los materiales se adaptan automáticamente a esa cuenta.
3. Estudia a tu ritmo: usa **Didáctico** o **Sin presión**, haz la pausa de respiración si hace falta, y gana ✦ puntos con cada avance.
4. Canjea los puntos por atuendos, accesorios o un marco en **Mi cuenta**. Si eres docente, activa el rol y prepara guías, rúbricas y juegos en **Docencia**.
5. Si quieres, configura tu nube en **Mi cuenta** y pulsa **Subir ahora**. Tu cuenta seguirá funcionando sin red.

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

### Respaldo opcional en la nube

En **Mi cuenta → Guardado en la nube (opcional)** puedes configurar una URL propia y un token. El servidor local solo habla con esa URL cuando pulsas **Probar conexión**, **Subir ahora** o **Bajar ahora**.

- El endpoint debe aceptar `PUT` con JSON (subir) y `GET` (bajar). Un `404` en `GET` significa «todavía no hay respaldo».
- Si pones token, se envía como `Authorization: Bearer …` solo a esa URL.
- El token se guarda en `.data/config.json` de este equipo; la interfaz lo muestra enmascarado.
- Bajar un respaldo pide confirmación porque reemplaza las cuentas locales.
- El respaldo incluye todas las cuentas, cursos, chat, tarjetas, estadísticas y grupos. Las fotos de cuenta se conservan; las imágenes de ejercicios se omiten para no inflar el archivo.

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
│   ├── app.js                cuentas, tutor 3D, recompensas, nube, docencia y vistas
│   ├── styles.css            identidad visual obsidiana / jade / oro
│   ├── sw.js                 service worker
│   ├── manifest.webmanifest
│   ├── icon.svg              logo mark oficial (copia)
│   ├── icons/                logo, wordmarks, PNG 16/32/48/180/192/512 y SVG originales aportados
│   ├── tutors/               ilustraciones SVG de búho, lobo, águila, zorro y maestro
│   ├── apple-touch-icon.png  icono iOS
│   └── favicon.ico           icono del navegador
└── tests/core.test.mjs
```

## Pruebas

```bash
npm test
```

## Releases automáticos

GitHub Actions ejecuta las pruebas en Node 18, 20 y 22 en cada push o PR. Para publicar una versión:

```bash
git tag v0.4.0
git push origin v0.4.0
```

El workflow `release.yml` crea una release con notas generadas automáticamente y tres archivos: código fuente en ZIP, código fuente en TAR.GZ y la PWA lista para desplegar (`-pwa.zip`).

## Contribuir

1. Haz un fork del repositorio.
2. Crea una rama: `git checkout -b mi-mejora`.
3. Añade cambios y pruebas: `npm test`.
4. Abre un *pull request* describiendo qué mejoraste.

Las ideas bienvenidas: lectura de PDFs, más proveedores, traducción al náhuatl/inglés, temas visuales adicionales y empaquetado móvil/de escritorio.

## Identidad visual

Obsidiana como fondo, **jade** para el dominio del conocimiento y **oro** para la disciplina y la excelencia. El logo mark y los wordmarks aportados se usan en favicon, PWA, encabezados y panel de cuenta; los tutores son ilustraciones SVG detalladas de animales y de un maestro, animadas con perspectiva CSS. Tipografía: *Cinzel* para los títulos e *Inter* para el texto.

Los términos náhuatl del glosario y del modo bilingüe provienen del **Breve vocabulario filosófico náhuatl** del Instituto de Investigaciones Históricas de la UNAM y del **Wired Humanities Nahuatl Dictionary**.

## Límites conocidos (MVP)

- Los PDFs no se leen directamente: copia el texto o sube una imagen de la página.
- Las imágenes de ejercicios se guardan en `localStorage` solo mientras se envían; mantenlas pequeñas (≤ 2 MB). La foto de cuenta se reduce a 160 px.
- La generación no hace streaming token a token: muestra «pensando» y después la respuesta completa.
- El simulacro corrige automáticamente las objetivas; las desarrolladas muestran la rúbrica y puedes pedirle al tutor que las corrija. El modo sin presión quita el temporizador, pero no cambia la corrección.
- Los puntos, atuendos, accesorios e insignias son motivación local: no se compran, no se comparan y no afectan a tus notas.
- El tutor 3D es CSS con perspectiva, no un modelo WebGL: busca ligereza y compatibilidad antes que realismo.
- No hay sincronización automática: exporta e importa JSON o usa tu propio respaldo en la nube. El progreso docente se arma importando los JSON de cada estudiante.

## Licencia

MIT. Úsalo, estúdialo, cámbialo y compártelo. El conocimiento, como en el calmecac, se multiplica cuando se enseña.
