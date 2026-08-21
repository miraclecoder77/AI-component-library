import { z } from "zod";

/**
 * The extraction target for the structured-output demo.
 *
 * Defined once in Zod and converted to JSON Schema for Gemini, so the
 * constraint the model is given and the type the UI renders can never drift
 * apart. `describe` calls are not decoration -- they are the field-level
 * instructions the model actually reads.
 */
export const JobPosting = z.object({
  title: z.string().describe("The job title, normalised and title-cased."),
  company: z.string().describe("Hiring company name."),
  location: z
    .string()
    .describe("Location as written, e.g. 'Remote (EU)' or 'Berlin, DE'."),
  employmentType: z
    .enum(["full_time", "part_time", "contract", "internship"])
    .describe("Employment type."),
  salaryMin: z
    .number()
    .nullable()
    .describe("Lower bound of the salary range, or null if not stated."),
  salaryMax: z
    .number()
    .nullable()
    .describe("Upper bound of the salary range, or null if not stated."),
  currency: z
    .string()
    .nullable()
    .describe("ISO 4217 code such as EUR or USD, or null if not stated."),
  skills: z
    .array(z.string())
    .describe("Named technologies and skills, at most eight."),
  remote: z.boolean().describe("True when the role can be done fully remotely."),
});

export type JobPosting = z.infer<typeof JobPosting>;

/**
 * Field order for progressive rendering.
 *
 * The demo shows fields in this order so early-arriving values land at the
 * top and the form fills downward, which reads as progress. Left to object
 * key order it would appear to fill at random.
 */
export const JOB_POSTING_FIELDS = [
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "location", label: "Location" },
  { key: "employmentType", label: "Type" },
  { key: "remote", label: "Remote" },
  { key: "salaryMin", label: "Salary from" },
  { key: "salaryMax", label: "Salary to" },
  { key: "currency", label: "Currency" },
  { key: "skills", label: "Skills" },
] as const;

/** JSON Schema handed to Gemini. */
export function jobPostingJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(JobPosting) as Record<string, unknown>;
  // Gemini rejects the $schema meta-key on response schemas.
  delete schema.$schema;
  return schema;
}

/** Sample input so the demo is one click away from showing something. */
export const SAMPLE_JOB_POSTING = `We're Northwind Labs, and we're looking for a Senior Frontend Engineer to join our product team. This is a fully remote role open to anyone in the EU.

You'll own our design system and the streaming interfaces in our core product. We care a lot about accessibility and about how things feel under load. Our stack is TypeScript and React.

Salary is 95,000-125,000 EUR depending on experience. Full time, permanent.`;
