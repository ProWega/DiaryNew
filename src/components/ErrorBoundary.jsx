import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Centralized client-error capture point. Replace with Sentry SDK when ready.
    if (typeof window !== "undefined" && window.console) {
      window.console.error("[ErrorBoundary]", error, info?.componentStack);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="app-shell" role="alert">
          <div className="feedback-state">
            <h2>Что-то пошло не так</h2>
            <p>
              Произошла непредвиденная ошибка интерфейса. Попробуйте обновить страницу. Если
              проблема повторится — сообщите команде с временем и тем, что вы делали.
            </p>
            <button type="button" className="primary-button" onClick={this.handleReload}>
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
