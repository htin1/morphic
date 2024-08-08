import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const exampleMessages = [
  {
    heading: 'Where are the configuration files for setting up a Temporal server?',
    message: 'Where are the configuration files for setting up a Temporal server?'
  },
  {
    heading: 'How is the Workflow Execution started in the Temporal codebase?',
    message: 'How is the Workflow Execution started in the Temporal codebase?'
  },
  {
    heading: 'Can you explain the architecture of Temporal?',
    message: 'Can you explain the architecture of Temporal?'
  },
  {
    heading: 'How can I handle timeouts and retries in Temporal?',
    message: 'How can I handle timeouts and retries in Temporal?'
  }
]
export function EmptyScreen({
  submitMessage,
  className
}: {
  submitMessage: (message: string) => void
  className?: string
}) {
  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        <div className="mt-4 flex flex-col items-start space-y-2 mb-4">
          {exampleMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base"
              name={message.message}
              onClick={async () => {
                submitMessage(message.message)
              }}
            >
              <ArrowRight size={16} className="mr-2 text-muted-foreground" />
              {message.heading}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
