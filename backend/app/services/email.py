import smtplib
from email.message import EmailMessage
from typing import List, Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailSender:
    """
    Gestor nativo para envío de correos vía SMTP.
    """
    
    @staticmethod
    def enviar_correo(
        destinatarios: List[str], 
        asunto: str, 
        contenido_texto: str, 
        contenido_html: Optional[str] = None
    ) -> bool:
        """
        Envía un correo electrónico. En un entorno real se ejecuta como BackgroundTask.
        """
        # Evitar fallos si la variable de entorno no está seteada (desarrollo local)
        if not settings.SMTP_PASSWORD or "[VALOR_OCULTO_EN_.ENV]" in settings.SMTP_PASSWORD:
            logger.warning("Simulando envío de correo: Credenciales SMTP no configuradas en .env")
            logger.info(f"SIMULACIÓN -> To: {destinatarios}, Asunto: {asunto}")
            return True

        msg = EmailMessage()
        msg["Subject"] = asunto
        msg["From"] = settings.SMTP_USER
        msg["To"] = ", ".join(destinatarios)
        msg.set_content(contenido_texto)
        
        if contenido_html:
            msg.add_alternative(contenido_html, subtype="html")
            
        try:
            # Usando SMTP con TLS
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            return True
        except Exception as e:
            logger.error(f"Error crítico al enviar correo a {destinatarios}: {str(e)}")
            # Dependiendo de la regla, aquí se inserta un registro en AUDITORIA_EVENTO
            return False
