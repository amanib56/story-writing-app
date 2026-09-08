"use client";

type ConfirmModalProps = {
  isOpen: boolean;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({ isOpen, itemName, onCancel, onConfirm }: ConfirmModalProps) {
  if (!isOpen) return null;

  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
    <form className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onConfirm(); } }} onSubmit={(event) => { event.preventDefault(); onConfirm(); }}>
      <h2 id="delete-dialog-title">Delete item?</h2>
      <p><strong>{itemName || "Untitled item"}</strong> and everything inside it will be permanently removed.</p>
      <div className="modal-actions"><button className="modal-cancel" type="button" onClick={onCancel}>Cancel</button><button className="modal-delete" type="submit" autoFocus>Delete</button></div>
    </form>
  </div>;
}