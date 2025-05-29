import React from "react";
import PropTypes from "prop-types";

/**
 * PUBLIC_INTERFACE
 * ConfirmationModal - A reusable confirm/cancel dialog modal for destructive actions.
 */
const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
}) => {
  // Trap focus to modal (basic accessibility)
  React.useEffect(() => {
    if (isOpen) {
      // Focus the confirm button
      const confirmBtn = document.getElementById("confirm-modal-btn");
      if (confirmBtn) confirmBtn.focus();
      // Prevent scrolling background (typical modal pattern)
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="confirmation-modal-overlay" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="confirmation-modal">
        {title && <h2>{title}</h2>}
        {message && <p className="confirmation-modal-message">{message}</p>}
        <div className="confirmation-modal-actions">
          <button
            id="confirm-modal-btn"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: "#c0392b",
              color: "#fff",
              minWidth: "100px",
              marginRight: "16px",
              borderRadius: "6px",
              border: "none",
              fontWeight: "bold",
              padding: "10px 18px",
              fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Deleting..." : confirmText}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
            style={{
              minWidth: "100px",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "1rem",
              padding: "10px 18px"
            }}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  loading: PropTypes.bool,
};

export default ConfirmationModal;
