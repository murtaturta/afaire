export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your app preferences</p>
      </header>
      <div className="p-12 border-2 border-dashed border-border rounded-xl text-center">
        <p className="text-lg text-muted-foreground">Configuration options will appear here</p>
      </div>
    </div>
  );
}
