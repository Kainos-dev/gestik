// src/app/login/page.tsx
import { LoginForm } from './login-form';

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-200 p-6">
            <div className="w-full max-w-sm space-y-6 rounded-lg border bg-background p-8 shadow-sm">
                <div className="space-y-1 text-center">
                    <h1 className="text-xl font-semibold">Gestik</h1>
                    <p className="text-sm text-muted-foreground">Ingresá el PIN de acceso del equipo</p>
                </div>
                <LoginForm />
            </div>
        </div>
    );
}
