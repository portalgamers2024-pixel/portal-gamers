import discord
from discord.ext import commands
import os
import asyncio

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
        await crear_ticket(interaction, "compra")

    @discord.ui.button(label="📦 Soporte post-venta", style=discord.ButtonStyle.secondary, custom_id="ticket_soporte")
    async def soporte(self, interaction: discord.Interaction, button: discord.ui.Button):
        await crear_ticket(interaction, "soporte")

    @discord.ui.button(label="⭐ Dejar referencia", style=discord.ButtonStyle.success, custom_id="ticket_referencia")
    async def referencia(self, interaction: discord.Interaction, button: discord.ui.Button):
        await crear_ticket(interaction, "referencia")

    @discord.ui.button(label="🔍 Verificación proveedor", style=discord.ButtonStyle.danger, custom_id="ticket_proveedor")
    async def proveedor(self, interaction: discord.Interaction, button: discord.ui.Button):
        await crear_ticket(interaction, "proveedor")

async def crear_ticket(interaction: discord.Interaction, tipo: str):
    guild = interaction.guild
    member = interaction.user

    existing = discord.utils.get(guild.text_channels, name=f"ticket-{member.name.lower()}-{tipo}")
    if existing:
        await interaction.response.send_message(f"⚠️ Ya tienes un ticket abierto: {existing.mention}", ephemeral=True)
        return

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
        "soporte": f"📦 **Ticket de Soporte**\n\nHola {member.mention}! Cuéntanos el problema con tu pedido y lo resolveremos a la brevedad.",
        "referencia": f"⭐ **Dejar Referencia**\n\nHola {member.mention}! Gracias por confiar en nosotros.\n\nPor favor comparte:\n• Juego y servidor\n• Tu experiencia de compra\n• Calificación del 1 al 5",
        "proveedor": f"🔍 **Verificación de Proveedor**\n\nHola {member.mention}! Para unirte a nuestra red indica:\n• Juego(s) que ofreces\n• Servidores disponibles\n• Método de contacto"
    }

    close_view = CloseView()
    await channel.send(mensajes[tipo], view=close_view)
    await interaction.response.send_message(f"✅ Tu ticket fue creado: {channel.mention}", ephemeral=True)

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
    print(f"✅ Bot conectado como {bot.user}")
    bot.add_view(TicketView())
    bot.add_view(CloseView())
    try:
        synced = await bot.tree.sync()
        print(f"✅ {len(synced)} comandos sincronizados")
    except Exception as e:
        print(f"❌ Error sync: {e}")

token = os.environ.get("BOT_TOKEN")
if not token:
    raise ValueError("BOT_TOKEN environment variable not set")
bot.run(token)
