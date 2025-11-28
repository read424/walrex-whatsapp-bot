#!/usr/bin/env python3
"""
Script para obtener la última publicación de cualquier cuenta pública de Instagram
Usando Instaloader - la herramienta más robusta y mantenida

Instalación:
pip install instaloader

Uso:
python3 get_instagram_post.py bcv.org.ve
python3 get_instagram_post.py bcv.org.ve --json
"""

import sys
import json
import instaloader
from datetime import datetime

def get_latest_post(username, output_json=False):
    """
    Obtiene la última publicación de una cuenta de Instagram

    Args:
        username (str): Nombre de usuario sin @
        output_json (bool): Si True, retorna JSON en lugar de imprimir

    Returns:
        dict: Datos de la publicación si output_json=True
    """
    try:
        # Crear instancia de Instaloader
        L = instaloader.Instaloader()

        # No requiere login para cuentas públicas
        # Si necesitas acceder a más info, puedes hacer login:
        # L.login("tu_usuario", "tu_password")

        if not output_json:
            print(f"📷 Obteniendo última publicación de @{username}...\n")

        # Obtener perfil
        profile = instaloader.Profile.from_username(L.context, username)

        # Obtener información del perfil
        profile_data = {
            'username': profile.username,
            'full_name': profile.full_name,
            'biography': profile.biography,
            'followers': profile.followers,
            'following': profile.followees,
            'posts_count': profile.mediacount,
            'is_private': profile.is_private,
            'is_verified': profile.is_verified,
            'profile_pic_url': profile.profile_pic_url
        }

        if profile.is_private:
            if output_json:
                return {'error': 'Cuenta privada. No se puede acceder sin seguir.'}
            else:
                print("❌ Esta cuenta es privada. No se puede acceder sin seguir.")
                return None

        # Obtener la última publicación
        posts = profile.get_posts()
        latest_post = next(posts)

        # Extraer datos del post
        post_data = {
            'shortcode': latest_post.shortcode,
            'url': f'https://www.instagram.com/p/{latest_post.shortcode}/',
            'date': latest_post.date_utc.isoformat(),
            'date_local': latest_post.date_local.strftime('%Y-%m-%d %H:%M:%S'),
            'caption': latest_post.caption,
            'likes': latest_post.likes,
            'comments': latest_post.comments,
            'is_video': latest_post.is_video,
            'video_url': latest_post.video_url if latest_post.is_video else None,
            'image_url': latest_post.url,
            'typename': latest_post.typename,
            'owner_username': latest_post.owner_username,
            'owner_id': latest_post.owner_id
        }

        # Si es carrusel, obtener todas las imágenes
        if latest_post.typename == 'GraphSidecar':
            post_data['media_count'] = latest_post.mediacount
            post_data['media_urls'] = []
            for node in latest_post.get_sidecar_nodes():
                post_data['media_urls'].append({
                    'is_video': node.is_video,
                    'url': node.video_url if node.is_video else node.display_url
                })

        # Combinar datos
        result = {
            'profile': profile_data,
            'latest_post': post_data
        }

        if output_json:
            return result
        else:
            # Imprimir información formateada
            print("═══════════════════════════════════════════════════════")
            print("   📊 INFORMACIÓN DEL PERFIL")
            print("═══════════════════════════════════════════════════════\n")
            print(f"Usuario: @{profile_data['username']}")
            print(f"Nombre: {profile_data['full_name']}")
            print(f"Seguidores: {profile_data['followers']:,}")
            print(f"Siguiendo: {profile_data['following']:,}")
            print(f"Publicaciones: {profile_data['posts_count']:,}")
            if profile_data['is_verified']:
                print("✓ Cuenta verificada")
            print(f"\nBiografía:\n{profile_data['biography']}")

            print("\n═══════════════════════════════════════════════════════")
            print("   📷 ÚLTIMA PUBLICACIÓN")
            print("═══════════════════════════════════════════════════════\n")
            print(f"📅 Fecha: {post_data['date_local']}")
            print(f"🔗 URL: {post_data['url']}")
            print(f"❤️  Likes: {post_data['likes']:,}")
            print(f"💬 Comentarios: {post_data['comments']:,}")

            if post_data['is_video']:
                print(f"🎥 Tipo: Video")
                print(f"📹 Video URL: {post_data['video_url']}")
            elif post_data['typename'] == 'GraphSidecar':
                print(f"🎠 Tipo: Carrusel ({post_data['media_count']} elementos)")
            else:
                print(f"📷 Tipo: Imagen")

            print("\n📄 Caption:")
            print("─────────────────────────────────────────────────────")
            if post_data['caption']:
                caption = post_data['caption']
                # Limitar a 500 caracteres para visualización
                if len(caption) > 500:
                    caption = caption[:500] + '...'
                print(caption)
            else:
                print("(Sin texto)")
            print("─────────────────────────────────────────────────────")

            print(f"\n🖼️  Imagen: {post_data['image_url']}")

            if post_data['typename'] == 'GraphSidecar':
                print(f"\n📸 {post_data['media_count']} elementos en el carrusel:")
                for i, media in enumerate(post_data['media_urls'], 1):
                    media_type = "Video" if media['is_video'] else "Imagen"
                    print(f"   {i}. {media_type}: {media['url']}")

            print("\n═══════════════════════════════════════════════════════\n")
            print("✅ Script completado exitosamente")

            return result

    except instaloader.exceptions.ProfileNotExistsException:
        if output_json:
            return {'error': f'Cuenta @{username} no encontrada'}
        else:
            print(f"❌ Cuenta @{username} no encontrada")
            return None

    except instaloader.exceptions.ConnectionException as e:
        if output_json:
            return {'error': f'Error de conexión: {str(e)}'}
        else:
            print(f"❌ Error de conexión: {str(e)}")
            print("💡 Instagram puede haber bloqueado temporalmente tu IP.")
            print("   Espera unos minutos antes de volver a intentar.")
            return None

    except instaloader.exceptions.QueryReturnedBadRequestException:
        if output_json:
            return {'error': 'Instagram bloqueó la solicitud'}
        else:
            print("❌ Instagram bloqueó la solicitud")
            print("💡 Esto puede suceder si haces muchas peticiones seguidas.")
            print("   Recomendación: Usa un usuario y contraseña (login) para evitar límites.")
            return None

    except Exception as e:
        if output_json:
            return {'error': f'Error inesperado: {str(e)}'}
        else:
            print(f"❌ Error inesperado: {str(e)}")
            return None


def main():
    """Función principal"""
    if len(sys.argv) < 2:
        print("Uso: python3 get_instagram_post.py <username> [--json]")
        print("\nEjemplo:")
        print("  python3 get_instagram_post.py bcv.org.ve")
        print("  python3 get_instagram_post.py bcv.org.ve --json")
        sys.exit(1)

    username = sys.argv[1].replace('@', '')
    output_json = '--json' in sys.argv

    if not output_json:
        print("═══════════════════════════════════════════════════════")
        print("   📷 INSTAGRAM - Obtener Última Publicación")
        print("═══════════════════════════════════════════════════════\n")

    result = get_latest_post(username, output_json)

    if output_json and result:
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()