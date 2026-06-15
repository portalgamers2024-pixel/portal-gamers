import discord
from discord.ext import commands
import os
import sys
import asyncio

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

GUILD_ID = 1165327408933650444
TICKET_CHANNEL_NAME = "🎫-abrir-ticket"

class TicketView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="🛒 Comprar", style=discord.ButtonStyle.primary, custom_id="ticket_comprar")
    async def comprar(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            await interaction.response.send_message("✅ Abriendo ticket de compra...", ephemeral=True)
        except Exception as e:
            print(f"❌ Error: {e}")

    @discord.ui.button(label="💰 Vender", style=discord.ButtonStyle.success, custom_id="ticket_vender")
    async def vender(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            await interaction.response.send_message("✅ Abriendo ticket de venta...", ephemeral=True)
        except Exception as e:
            print(f"❌ Error: {e}")

@bot.event
async def on_ready():
    print(f"✅ Bot conectado como {bot.user}")

    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print(f"❌ No se encontró el servidor con ID {GUILD_ID}")
            return

        # Buscar canal #abrir-ticket
        channel = discord.utils.get(guild.text_channels, name=TICKET_CHANNEL_NAME)
        if not channel:
            print(f"❌ No se encontró el canal {TICKET_CHANNEL_NAME}")
            return

        print(f"📍 Canal encontrado: {channel.mention}")

        # Obtener últimos 10 mensajes del bot
        messages_to_delete = []
        async for msg in channel.history(limit=20):
            if msg.author == bot.user:
                messages_to_delete.append(msg)

        # Eliminar mensajes antiguos del bot
        if messages_to_delete:
            print(f"🗑️  Eliminando {len(messages_to_delete)} mensaje(s) anterior(es)...")
            for msg in messages_to_delete:
                try:
                    await msg.delete()
                    print(f"   ✓ Mensaje eliminado")
                except Exception as e:
                    print(f"   ❌ Error al eliminar: {e}")

        # Crear nuevo embed
        embed = discord.Embed(
            title="🎫 ABRE UN TICKET",
            description="Haz clic en uno de los botones a continuación para:\n\n"
                        "🛒 **Comprar** - Cotización de Kamas / Silver / Gold\n"
                        "💰 **Vender** - Procesar tu venta\n\n"
                        "Un administrador te atenderá a la brevedad ⚡",
            color=discord.Color.blue()
        )
        embed.set_footer(text="Portal Gamers LATAM", icon_url="https://portalgamerslatam.com/images/logo.png")

        # Enviar nuevo mensaje con botones
        view = TicketView()
        msg = await channel.send(embed=embed, view=view)
        print(f"✅ Nuevo mensaje publicado: {msg.jump_url}")

        # Registrar la vista para persistencia
        bot.add_view(view)

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await bot.close()

token = os.environ.get("BOT_TOKEN")
if not token:
    raise ValueError("BOT_TOKEN environment variable not set")

bot.run(token)
