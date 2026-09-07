from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ConfiguracionItem(BaseModel):
    clave: str
    valor: str
    descripcion: Optional[str] = None
    tipo_dato: str = "STRING"

    class Config:
        from_attributes = True

class ConfiguracionUpdate(BaseModel):
    clave: str
    valor: str

class ConfiguracionBulkUpdate(BaseModel):
    items: List[ConfiguracionUpdate]

class ConfiguracionesAgrupadas(BaseModel):
    etl: Dict[str, Any]
    smtp: Dict[str, Any]
    politicas: Dict[str, Any]

class SMTPTestRequest(BaseModel):
    destinatario: str

class ETLTriggerResponse(BaseModel):
    mensaje: str
    timestamp: datetime
