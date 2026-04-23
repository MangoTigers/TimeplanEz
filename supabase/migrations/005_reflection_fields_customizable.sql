-- Add customizable reflection field configuration per user.

alter table public.users
add column if not exists reflection_fields jsonb not null default '[
  {
    "id": "taskCompleted",
    "label": "Task Completed",
    "type": "textarea",
    "placeholder": "What tasks did you complete?"
  },
  {
    "id": "howItWent",
    "label": "How It Went",
    "type": "textarea",
    "placeholder": "How did the shift go?"
  },
  {
    "id": "completedPlannedWork",
    "label": "Completed Planned Work",
    "type": "checkbox"
  },
  {
    "id": "neededHelp",
    "label": "Needed Help",
    "type": "checkbox"
  },
  {
    "id": "learnedSomething",
    "label": "Learned Something",
    "type": "checkbox"
  }
]'::jsonb;
