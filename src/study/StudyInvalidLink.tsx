import './StudyInvalidLink.css'

/**
 * Sem um `task` válido a aplicação não abre a Home.
 *
 * Um link quebrado que mostrasse o produto num estado genérico produziria
 * sessões de Maze sem cenário, com saldo e entradas de outra tarefa, e essas
 * respostas entrariam na análise sem que ninguém percebesse. A tela de erro é a
 * forma de essa sessão falhar de maneira visível.
 */
export function StudyInvalidLink() {
  return (
    <main className="study-invalid-link">
      <h1 className="study-invalid-link__title">
        Este enlace de prueba no es válido.
      </h1>
      <p className="study-invalid-link__body">
        Vuelve al estudio de Maze para continuar.
      </p>
    </main>
  )
}
