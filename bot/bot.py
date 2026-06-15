import discord
from discord.ext import commands
import os
import asyncio
import sys

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

GUILD_ID = 1165327408933650444
SOPORTE_CAT_ID = 1506457416450183298
LOG_CHANNEL_NAME = "✅-verificacion-proveedores"

class TicketView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="🛒 Comprar", style=discord.ButtonStyle.primary, custom_id="ticket_comprar")
    async def comprar(self, interaction: discord.Interaction, button: discord.ui.Button):
        await handle_ticket_button(interaction, "compra")

    @discord.ui.button(label="💰 Vender", style=discord.ButtonStyle.primary, custom_id="ticket_vender")
    async def vender(self, interaction: discord.Interaction, button: discord.ui.Button):
        await handle_ticket_button(interaction, "vender")

async def handle_ticket_button(interaction: discord.Interaction, tipo: str):
    try:
        await interaction.response.defer(ephemeral=True)
        await crear_ticket(interaction, tipo)
        msg = await interaction.followup.send(f"✅ Ticket creado!", ephemeral=True)
        await asyncio.sleep(3)
        try:
            await msg.delete()
        except discord.NotFound:
            pass
    except ValueError as ve:
        print(f"⚠️ Validación en {tipo}: {ve}")
        msg = await interaction.followup.send(f"⚠️ {str(ve)}", ephemeral=True)
        await asyncio.sleep(3)
        try:
            await msg.delete()
        except discord.NotFound:
            pass
    except Exception as e:
        print(f"❌ Error en botón {tipo.title()}: {e}")
        try:
            msg = await interaction.followup.send(f"❌ Error al crear ticket", ephemeral=True)
            await asyncio.sleep(3)
            try:
                await msg.delete()
            except discord.NotFound:
                pass
        except:
            pass

async def crear_ticket(interaction: discord.Interaction, tipo: str):
    guild = interaction.guild
    member = interaction.user

    existing = discord.utils.get(guild.text_channels, name=f"ticket-{member.name.lower()}-{tipo}")
    if existing:
        raise ValueError(f"Ya tienes un ticket abierto: {existing.mention}")

    cat = guild.get_channel(SOPORTE_CAT_ID)

    overwrites = {
        guild.default_role: discord.PermissionOverwrite(read_messages=False),
        member: discord.PermissionOverwrite(read_messages=True, send_messages=True),
        guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True)
    }

    for role in guild.roles:
        if role.permissions.administrator:
            overwrites[role] = discord.PermissionOverwrite(read_messages=True, send_messages=True)

    channel = await guild.create_text_channel(
        name=f"ticket-{member.name.lower()}-{tipo}",
        category=cat,
        overwrites=overwrites,
        topic=f"Ticket de {tipo} abierto por {member.name}"
    )

    mensajes = {
        "compra": f"🛒 **Ticket de Compra**\n\nHola {member.mention}! Un administrador te atenderá pronto.\n\nPor favor indica:\n• Juego y servidor\n• Cantidad que necesitas\n• País de pago\n\n🌐 https://portalgamerslatam.com",
        "vender": f"💰 **Ticket de Venta**\n\nHola {member.mention}! Un administrador te atenderá para procesar tu venta.\n\nPor favor indica:\n• Juego y servidor\n• Cantidad que deseas vender\n• Tu método de pago preferido\n\n🌐 https://portalgamerslatam.com"
    }

    close_view = CloseView()
    await channel.send(mensajes[tipo], view=close_view)

class CloseView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="🔒 Cerrar ticket", style=discord.ButtonStyle.danger, custom_id="cerrar_ticket")
    async def cerrar(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("🔒 Cerrando ticket en 5 segundos...")
        await asyncio.sleep(5)
        await interaction.channel.delete()

@bot.event
async def on_ready():
    try:
        print(f"✅ Bot conectado como {bot.user}")
        bot.add_view(TicketView())
        bot.add_view(CloseView())
        try:
            synced = await bot.tree.sync()
            print(f"✅ {len(synced)} comandos sincronizados")
        except Exception as e:
            print(f"❌ Error sync: {e}")
    except Exception as e:
        print(f"❌ Error en on_ready: {e}")

token = os.environ.get("BOT_TOKEN")
if not token:
    raise ValueError("BOT_TOKEN environment variable not set")
bot.run(token)
