import {
    ChevronDown as ChevronDownIcon,
    BrainIcon,
    Loader2,
} from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import { useState, useEffect, useRef } from "react";

export const ThinkBlock = ({
    content,
    isComplete,
}: {
    content: string;
    isComplete: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(!isComplete);
    const prevIsCompleteRef = useRef<boolean>();

    // When the block transitions from incomplete to complete, close it
    useEffect(() => {
        if (
            prevIsCompleteRef.current === false &&
            isComplete === true &&
            isOpen
        ) {
            setIsOpen(false);
        }
        prevIsCompleteRef.current = isComplete;
    }, [isComplete, isOpen]);

    // Don't render anything if children is empty
    if (!content || (typeof content === "string" && content.trim() === "")) {
        return null;
    }

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="my-4 max-w-full rounded-md border text-sm text-muted-foreground"
            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                e.stopPropagation(); // prevent message from selecting
            }}
        >
            <CollapsibleTrigger className="group flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left font-geist-mono font-[350] hover:text-foreground">
                <div className="flex items-center">
                    {!isComplete ? (
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    ) : (
                        <div className="mr-2">
                            <BrainIcon className="w-3 h-3" />
                        </div>
                    )}
                    Thoughts
                </div>
                <div className="flex items-center">
                    <ChevronDownIcon className="w-3 h-3 inline-block transition-transform group-data-[state=open]:rotate-180" />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="">
                <div className="">
                    <div className="px-2 py-4 text-sm text-muted-foreground whitespace-pre-wrap">
                        {content.trim()}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
