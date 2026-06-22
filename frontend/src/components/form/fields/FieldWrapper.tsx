interface FieldWrapperProps {
  label: string;
  required: boolean;
  error?: string;
  children: React.ReactNode;
}

export default function FieldWrapper({
  label,
  required,
  error,
  children,
}: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-white/80">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}