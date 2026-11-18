# Piter Apps

Web de presentación de PITER MUSIC. HTML, CSS y JavaScript sin dependencias de compilación. La carpeta `site/` contiene la vista previa con las descargas locales.

## Vista previa

Abre `site/index.html` o inicia el servidor local con Node.js 22 o posterior.

```powershell
node scripts/preview.mjs
node scripts/release-check.mjs --local
```

El servidor escucha en `http://127.0.0.1:8736/`. Las copias locales de los binarios se guardan en `site/downloads/`, excluido de Git.

## Publicación

La web se despliega en GitHub Pages. Los dos archivos de distribución se publican como activos de GitHub Releases. La tarea **Publicar Piter Apps** verifica que ambos activos son públicos, comprueba tamaño y SHA-256 y prueba el inicio de cada descarga antes de generar el sitio.

Consulta `releases.json` para ver el tag, los nombres, tamaños y huellas de los paquetes. Si cambian los paquetes aprobados o su nombre, actualiza también las instrucciones y enlaces de vista previa en `site/index.html`.

El contador usa `download_count` de GitHub Releases para cada activo. Se consulta al abrir la web y muestra la hora de la consulta. Si el servicio falla, se muestra el estado sin datos. No se generan cifras locales. GitHub puede contar descargas técnicas. Las cifras reflejan descargas del activo y no instalaciones únicas.

## Comentarios

El sitio muestra el foro pendiente mientras falten las variables públicas `PITER_COMMENTS_ENDPOINT` y `PITER_TURNSTILE_SITEKEY`. Puedes publicar primero la web y activar el foro después.

1. Crea una base de Cloudflare D1 y ejecuta `comments/schema.sql`.
2. Copia `comments/wrangler.example.toml` a `comments/wrangler.toml`. Ajusta la ID de D1 y el origen público de GitHub Pages.
3. Crea un widget Turnstile para el hostname de Pages. En el Worker, registra la clave secreta como `TURNSTILE_SECRET` y una cadena aleatoria con suficiente entropía como `RATE_SECRET`. Ambos valores van en los secretos de Cloudflare.
4. Despliega `comments/worker.mjs` con el binding de D1 y conserva la tarea programada de limpieza de límites.
5. En las variables de Actions del repositorio, añade el endpoint HTTPS completo acabado en `/comments` y la clave pública del widget. Ejecuta de nuevo el flujo de Pages.
6. Prueba el envío en la web. Comprueba que aparece en D1 como pendiente y que es visible al aprobarlo.

D1 guarda un nombre o alias, el texto, una fecha UTC y el estado de moderación. El límite de un envío por cinco minutos usa un HMAC de la IP, sin guardar la IP en texto. Los identificadores de límite vencen a los cinco minutos y se depuran en nuevos envíos válidos y en la limpieza programada. Turnstile recibe lo necesario para verificar el desafío. Los visitantes no necesitan cuenta ni correo.

La cola se administra desde la consola D1 de Cloudflare. Sustituye el ID de ejemplo por el que corresponda. El listado público muestra los últimos 50 comentarios aprobados.

```sql
SELECT id, name, message, created FROM comments WHERE approved = 0 ORDER BY id DESC;
UPDATE comments SET approved = 1 WHERE id = 42;
UPDATE comments SET approved = 0 WHERE id = 42;
DELETE FROM comments WHERE id = 42;
```

- [GitHub Pages con un flujo personalizado](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Datos de los activos de GitHub Releases](https://docs.github.com/en/rest/releases/assets)
- [Validación de Turnstile en el servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
