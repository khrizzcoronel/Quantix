import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import { 
  X, User as UserIcon, Mail, Phone, Lock, Eye, EyeOff, 
  Camera, Trash2, Loader2, CheckCircle2, AlertCircle, 
  ChevronDown, ChevronUp, UserCircle 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface PerfilUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function PerfilUsuarioModalDialog({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  // Form State inicializado directamente al montar el modal
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [email, setEmail] = useState(user?.email || '');
  const [telefono, setTelefono] = useState(user?.telefono || '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);

  // Password Change State
  const [cambiarPassword, setCambiarPassword] = useState(false);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');

  // Password Visibility State
  const [showPasswordActual, setShowPasswordActual] = useState(false);
  const [showPasswordNuevo, setShowPasswordNuevo] = useState(false);
  const [showPasswordConfirmar, setShowPasswordConfirmar] = useState(false);

  // UI Status State
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const rol = user?.rol || 'CAJERO';

  const getRoleColorBadge = (r: string) => {
    switch (r) {
      case 'DIRECTOR':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'SUPERVISOR':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'BODEGUERO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'CAJERO':
      default:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
  };

  // Compresión automática HTML5 Canvas a 200x200 JPEG con calidad 0.85
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecciona un archivo de imagen válido (JPEG, PNG, WebP).');
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setErrorMessage('No se pudo inicializar el procesador de gráficos.');
            return;
          }

          // Recorte centrado (Center Crop) y reescalado a 200x200
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 200, 200);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(compressedDataUrl);
        } catch {
          setErrorMessage('Error al procesar la compresión de la imagen.');
        }
      };
      img.onerror = () => {
        setErrorMessage('No se pudo decodificar el archivo de imagen.');
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleQuitarFoto = () => {
    setAvatar(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validaciones
    if (!nombre.trim()) {
      setErrorMessage('El nombre completo no puede estar vacío.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('El correo electrónico no puede estar vacío.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (cambiarPassword || passwordNuevo || passwordActual || passwordConfirmar) {
      if (!passwordActual) {
        setErrorMessage('Debes ingresar tu contraseña actual para cambiarla.');
        return;
      }
      if (!passwordNuevo || passwordNuevo.length < 6) {
        setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (passwordNuevo !== passwordConfirmar) {
        setErrorMessage('La nueva contraseña y su confirmación no coinciden.');
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload: {
        nombre: string;
        email: string;
        telefono: string | null;
        avatar: string | null;
        password_actual?: string;
        password_nuevo?: string;
      } = {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim() ? telefono.trim() : null,
        avatar: avatar,
      };

      if ((cambiarPassword || passwordNuevo) && passwordNuevo) {
        payload.password_actual = passwordActual;
        payload.password_nuevo = passwordNuevo;
      }

      const res = await api.put('/usuarios/me', payload);

      updateProfile({
        nombre: res.data.nombre,
        email: res.data.email,
        telefono: res.data.telefono,
        avatar: res.data.avatar,
      });

      setSuccessMessage('¡Perfil actualizado con éxito!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      const displayError = typeof errorDetail === 'string'
        ? errorDetail
        : Array.isArray(errorDetail)
        ? errorDetail.map((e: any) => e.msg || e.detail || JSON.stringify(e)).join(', ')
        : 'Error al actualizar el perfil. Intenta nuevamente.';
      setErrorMessage(displayError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-quantix-50 dark:bg-quantix-900/30 text-quantix-600 dark:text-quantix-400 rounded-xl">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Editar Perfil de Usuario
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Actualiza tus datos personales, foto y credenciales
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificaciones de Éxito / Error */}
        {errorMessage && (
          <div className="mt-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1 font-bold">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Subida de foto de perfil con vista previa circular e indicador de rol */}
          <div className="flex flex-col items-center justify-center gap-3 py-2 bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            <div className="relative group/avatar">
              <div className="w-24 h-24 rounded-full border-3 border-quantix-500 shadow-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCircle className="w-20 h-20 text-gray-400 dark:text-gray-500" />
                )}
              </div>

              {/* Botón rápido de cámara sobre el avatar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="absolute bottom-0 right-0 bg-quantix-600 hover:bg-quantix-700 text-white p-2 rounded-full shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95"
                title="Subir foto de perfil"
                aria-label="Subir foto de perfil"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Indicador de Rol */}
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${getRoleColorBadge(rol)}`}>
                Rol: {rol}
              </span>
            </div>

            {/* Botones de acción de avatar */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-quantix-500 dark:hover:border-quantix-500 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-quantix-600 dark:text-quantix-400" />
                <span>Cambiar Foto</span>
              </button>

              {avatar && (
                <button
                  type="button"
                  onClick={handleQuitarFoto}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Quitar foto actual"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar Foto</span>
                </button>
              )}
            </div>

            <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
              Compresión automática optimizada a 200 × 200 px (JPEG)
            </span>
          </div>

          {/* Campos de datos personales */}
          <div className="space-y-3.5">
            {/* Nombre Completo */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Nombre Completo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={isSaving}
                  placeholder="Ej. Juan Pérez"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-quantix-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSaving}
                  placeholder="ejemplo@quantix.com"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-quantix-500 focus:border-transparent transition-all font-mono"
                />
              </div>
            </div>

            {/* Teléfono / Celular */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Teléfono / Celular
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  disabled={isSaving}
                  placeholder="+52 55 1234 5678"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-quantix-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* Sección Colapsable: Cambiar Contraseña */}
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/40 dark:bg-gray-800/30">
            <button
              type="button"
              onClick={() => {
                setCambiarPassword(!cambiarPassword);
                if (cambiarPassword) {
                  setPasswordActual('');
                  setPasswordNuevo('');
                  setPasswordConfirmar('');
                }
              }}
              disabled={isSaving}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-quantix-600 dark:text-quantix-400" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  Cambiar Contraseña
                </span>
                <span className="text-[10px] text-gray-400">
                  (Opcional)
                </span>
              </div>
              {cambiarPassword ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {cambiarPassword && (
              <div className="p-4 pt-2 space-y-3 border-t border-gray-200 dark:border-gray-800 animate-in fade-in duration-150">
                {/* Contraseña Actual */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Contraseña Actual <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordActual ? 'text' : 'password'}
                      value={passwordActual}
                      onChange={(e) => setPasswordActual(e.target.value)}
                      disabled={isSaving}
                      placeholder="Ingresa tu contraseña actual"
                      className="w-full px-3 py-2 pr-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-quantix-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordActual(!showPasswordActual)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    >
                      {showPasswordActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Nueva Contraseña */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Nueva Contraseña <span className="text-red-500">* (mín. 6 caracteres)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordNuevo ? 'text' : 'password'}
                      value={passwordNuevo}
                      onChange={(e) => setPasswordNuevo(e.target.value)}
                      disabled={isSaving}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2 pr-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-quantix-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordNuevo(!showPasswordNuevo)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    >
                      {showPasswordNuevo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Nueva Contraseña */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Confirmar Nueva Contraseña <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordConfirmar ? 'text' : 'password'}
                      value={passwordConfirmar}
                      onChange={(e) => setPasswordConfirmar(e.target.value)}
                      disabled={isSaving}
                      placeholder="Repite la nueva contraseña"
                      className="w-full px-3 py-2 pr-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-quantix-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirmar(!showPasswordConfirmar)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    >
                      {showPasswordConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer de Acciones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-quantix-600 hover:bg-quantix-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-quantix-600/20 transition-all cursor-pointer active:scale-95"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PerfilUsuarioModal({ isOpen, onClose }: PerfilUsuarioModalProps) {
  if (!isOpen) return null;
  return <PerfilUsuarioModalDialog onClose={onClose} />;
}
