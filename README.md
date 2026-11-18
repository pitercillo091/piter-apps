# Piter Apps

Web de presentación de PITER MUSIC y PITER VIDEO. HTML, CSS y JavaScript sin dependencias de compilación. La carpeta `site/` contiene la vista previa con las descargas locales.

## Vista previa

Abre `site/index.html` o inicia el servidor local con Node.js 22 o posterior.

```powershell
node scripts/preview.mjs
node scripts/release-check.mjs --local
```

El servidor escucha en `http://127.0.0.1:8736/`. Las copias locales de los binarios se guardan en `site/downloads/`, excluido de Git.

## Publicación

La web se despliega en GitHub Pages. Los archivos de distribución de cada proyecto se publican en una release propia de GitHub. La tarea **Publicar Piter Apps** verifica los cuatro recursos públicos, comprueba tamaño y SHA-256 y prueba el inicio de cada descarga antes de generar el sitio.

Consulta `releases.json` para ver los tags, nombres, tamaños y huellas de los paquetes. Si cambian los paquetes aprobados o su nombre, actualiza también las instrucciones y enlaces de vista previa en `site/index.html`.

El contador usa `download_count` de GitHub Releases para cada activo. Se consulta al abrir la web y muestra la hora de la consulta. Si el servicio falla, se muestra el estado sin datos. No se generan cifras locales. GitHub puede contar descargas técnicas. Las cifras reflejan descargas del activo y no instalaciones únicas.

## Comentarios

**Foro compartido por PITER MUSIC y PITER VIDEO.** El Worker `piter-apps-forum` está desplegado en Cloudflare, enlazado a D1 (`piter-apps-comments`) y protegido con Turnstile. GitHub Actions toma el endpoint y la clave pública del widget de `PITER_COMMENTS_ENDPOINT` y `PITER_TURNSTILE_SITEKEY`. El formulario se habilita en `https://piterapps.aquiestalatuna.es` cuando carga Turnstile.

### Privacidad y moderación

D1 conserva el alias/nombre, el texto, la fecha UTC y el estado de aprobación. Los comentarios nuevos quedan ocultos hasta su aprobación. No se conserva la IP en texto: el límite de envíos (uno cada cinco minutos) utiliza una huella HMAC temporal; la clave privada se guarda como secreto de Cloudflare. Los registros de límite caducan y se limpian mediante el cron del Worker. Turnstile verifica el desafío con Cloudflare. No se solicita correo ni se requiere registro.

La moderación se hace en la consola D1 de Cloudflare, en la base `piter-apps-comments`. Para localizar pendientes, revisar el texto antes de aprobar y borrar contenido abusivo:

```sql
SELECT id, name, message, created FROM comments WHERE approved = 0 ORDER BY id DESC;
UPDATE comments SET approved = 1 WHERE id = 42;
UPDATE comments SET approved = 0 WHERE id = 42;
DELETE FROM comments WHERE id = 42;
``

El listado público muestra los últimos 50 comentarios aprobados.

### Visitas

El Worker suma vistas de página en D1 por día. No guarda IP, cookies, identificadores de visitante, URL de página ni referente; por eso el dato mide vistas agregadas, no personas únicas. El contador visible ofrece el día actual, los últimos 30 días y el acumulado. Las cifras empiezan cuando se aplica la migración y se publica la nueva versión del Worker; no hay datos retroactivos.

Para habilitar el contador con Wrangler autenticado, desde `comments/` aplica primero `npx wrangler d1 migrations apply piter-apps-comments --remote` y luego `npx wrangler deploy`. La web se publica después mediante la tarea original de GitHub Pages.

- [GitHub Pages con un flujo personalizado](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Datos de los activos de GitHub Releases](https://docs.github.com/en/rest/releases/assets)
- [Validación de Turnstile en el servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
