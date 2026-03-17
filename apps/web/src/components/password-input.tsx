import { Button } from "@chopo-v1/ui/components/button";
import { Input } from "@chopo-v1/ui/components/input";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-9" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 h-full w-9 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}
