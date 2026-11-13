import { AppModal, Button } from '@/shared/ui';

import { useSessionGuard } from './useSessionGuard';

export function SessionTimeoutModal() {
  const { remaining, showWarning, keepAlive, keepingAlive, signOut } = useSessionGuard();

  return (
    <AppModal
      visible={showWarning}
      title="Tu sesión está por expirar"
      message={`Tu sesión expira en ${remaining ?? 0} segundos. ¿Deseas continuar conectado?`}
      actions={
        <>
          <Button title="Seguir conectado" onPress={() => void keepAlive()} loading={keepingAlive} />
          <Button title="Cerrar sesión" variant="ghost" onPress={() => void signOut()} />
        </>
      }
    />
  );
}
