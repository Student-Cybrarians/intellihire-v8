interface Props {
  message: string;
  onClose: () => void;
}

export const ErrorBanner = ({ message, onClose }: Props) => (
  <div className="bg-red-100 text-red-800 p-3 rounded-md mb-4 flex justify-between">
    <span>{message}</span>
    <button className="text-sm" onClick={onClose}>Close</button>
  </div>
);
