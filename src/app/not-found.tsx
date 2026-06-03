import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md mx-auto p-8">
        <p className="text-6xl font-bold text-primary/20">404</p>
        <h1 className="text-xl font-semibold text-foreground">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          La página que buscás no existe o fue movida.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
