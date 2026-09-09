import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
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
        return 'bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary-fixed-dim/30';
      case 'SUPERVISOR':
        return 'bg-secondary-fixed text-on-secondary-fixed border border-secondary-fixed-dim/30';
      case 'BODEGUERO':
        return 'bg-surface-container-high text-on-surface border border-outline-variant/30';
      case 'CAJERO':
      default:
        return 'bg-primary-fixed text-on-primary-fixed border border-primary-fixed-dim/30';
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
    <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">account_circle</span>
            </div>
            <div>
              <h3 className="font-headline-md text-title-lg text-on-surface">
                Editar Perfil de Usuario
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Actualiza tus datos personales, foto y credenciales de acceso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Notificaciones de Éxito / Error */}
        {errorMessage && (
          <div className="mt-4 p-3.5 bg-error-container text-on-error-container border border-error/20 text-body-sm rounded-2xl flex items-start gap-2.5 animate-in fade-in">
            <span className="material-symbols-outlined text-lg shrink-0 mt-0.5 text-error">warning</span>
            <span className="flex-1 font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3.5 bg-primary/10 text-primary border border-primary/20 text-body-sm rounded-2xl flex items-center gap-2.5 animate-in fade-in">
            <span className="material-symbols-outlined text-lg shrink-0 text-primary">check_circle</span>
            <span className="flex-1 font-bold">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Subida de foto de perfil con vista previa circular e indicador de rol */}
          <div className="flex flex-col items-center justify-center gap-3 py-3 bg-surface-container-low/50 rounded-2xl p-4 border border-outline-variant/20">
            <div className="relative group/avatar">
              <div className="w-24 h-24 rounded-full ring-4 ring-primary-container shadow-md overflow-hidden bg-surface-container flex items-center justify-center relative">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant">person</span>
                )}
              </div>

              {/* Botón rápido de cámara sobre el avatar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary hover:opacity-95 text-on-primary flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-110 active:scale-95"
                title="Subir foto de perfil"
                aria-label="Subir foto de perfil"
              >
                <span className="material-symbols-outlined text-sm">photo_camera</span>
              </button>
            </div>

            {/* Indicador de Rol en Pill */}
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-label-caps font-label-caps uppercase tracking-wider ${getRoleColorBadge(rol)}`}>
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
                className="h-9 px-4 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-headline-md text-body-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-base text-primary">photo_camera</span>
                <span>Cambiar Foto</span>
              </button>

              {avatar && (
                <button
                  type="button"
                  onClick={handleQuitarFoto}
                  disabled={isSaving}
                  className="h-9 px-4 rounded-full bg-error-container hover:bg-error text-on-error-container hover:text-on-error font-headline-md text-body-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Quitar foto actual"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  <span>Quitar Foto</span>
                </button>
              )}
            </div>

            <span className="text-body-sm text-on-surface-variant text-center">
              Compresión automática optimizada a 200 × 200 px (JPEG)
            </span>
          </div>

          {/* Campos de datos personales */}
          <div className="space-y-3.5">
            {/* Nombre Completo */}
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">
                Nombre Completo <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">person</span>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={isSaving}
                  placeholder="Ej. Juan Pérez"
                  className="w-full h-11 pl-11 pr-4 rounded-full bg-surface-container-low text-on-surface font-body-md placeholder:text-on-surface-variant focus:bg-surface-container focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">
                Correo Electrónico <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSaving}
                  placeholder="ejemplo@quantix.com"
                  className="w-full h-11 pl-11 pr-4 rounded-full bg-surface-container-low text-on-surface font-mono text-body-md placeholder:text-on-surface-variant focus:bg-surface-container focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Teléfono / Celular */}
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1.5">
                Teléfono / Celular
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">call</span>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  disabled={isSaving}
                  placeholder="+52 55 1234 5678"
                  className="w-full h-11 pl-11 pr-4 rounded-full bg-surface-container-low text-on-surface font-body-md placeholder:text-on-surface-variant focus:bg-surface-container focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Sección Colapsable: Cambiar Contraseña */}
          <div className="border border-outline-variant/20 rounded-2xl overflow-hidden bg-surface-container-low/40">
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
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-container transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">lock</span>
                <span className="font-headline-md text-body-md text-on-surface">
                  Cambiar Contraseña
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  (Opcional)
                </span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-lg">
                {cambiarPassword ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {cambiarPassword && (
              <div className="p-4 pt-2 space-y-3 border-t border-outline-variant/15 animate-in fade-in duration-150">
                {/* Contraseña Actual */}
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                    Contraseña Actual <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordActual ? 'text' : 'password'}
                      value={passwordActual}
                      onChange={(e) => setPasswordActual(e.target.value)}
                      disabled={isSaving}
                      placeholder="Ingresa tu contraseña actual"
                      className="w-full h-10 px-4 pr-10 rounded-full bg-surface-container-lowest text-on-surface font-body-md placeholder:text-on-surface-variant focus:bg-surface-container focus:outline-none transition-all border-0 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordActual(!showPasswordActual)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPasswordActual ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Nueva Contraseña */}
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                    Nueva Contraseña <span className="text-error">* (mín. 6 caracteres)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordNuevo ? 'text' : 'password'}
                      value={passwordNuevo}
                      onChange={(e) => setPasswordNuevo(e.target.value)}
                      disabled={isSaving}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full h-10 px-4 pr-10 rounded-full bg-surface-container-lowest text-on-surface font-body-md placeholder:text-on-surface-variant focus:bg-surface-container focus:outline-none transition-all border-0 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordNuevo(!showPasswordNuevo)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPasswordNuevo ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirmar Nueva Contraseña */}
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                    Confirmar Nueva Contraseña <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordConfirmar ? 'text' : 'password'}
                      value={passwordConfirmar}
                      onChange={(e) => setPasswordConfirmar(e.target.value)}
                      disabled={isSaving}
                      placeholder="Repite la nueva contraseña"
                      className="w-full h-10 px-4 pr-10 rounded-full bg-surface-container-lowest text-on-surface font-body-md placeholder:text-on-surface-variant focus:bg-surface-container focus:outline-none transition-all border-0 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirmar(!showPasswordConfirmar)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPasswordConfirmar ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer de Acciones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-11 px-6 rounded-full bg-primary text-on-primary hover:opacity-95 active:scale-98 font-headline-md text-body-md transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving && <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>}
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
