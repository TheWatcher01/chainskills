---
name: nextjs-app-builder
description: Build production-grade Next.js app with Tailwind, shadcn/ui, and Vercel best practices
version: 0.1.0
inputs:
  - name: app_description
    type: string
    required: true
    description: Description of the app to build (features, purpose, target users)
    default: null
  - name: components_list
    type: array
    required: false
    description: List of UI components to create (e.g., ["Button", "Card", "Form"])
    default: []
  - name: pages_list
    type: array
    required: false
    description: List of pages to create (e.g., ["Home", "Dashboard", "Settings"])
    default: []
  - name: quality_threshold
    type: number
    required: false
    description: Minimum quality score for design review (0.0-1.0)
    default: 0.85
outputs:
  - name: generated_components
    type: array
    description: List of generated component files with paths
  - name: generated_pages
    type: array
    description: List of generated page files with paths
  - name: design_review_report
    type: object
    description: UI design compliance report
  - name: performance_review_report
    type: object
    description: Performance optimization report
  - name: recommendations
    type: array
    description: Actionable recommendations for improvement
env:
  - AGENT_API_KEY
tags:
  - nextjs
  - react
  - tailwind
  - shadcn-ui
  - vercel
  - frontend
  - web-development
metadata:
  author: workflows-creator
  license: MIT
  requires:
    - frontend-design skill
    - vercel-react-best-practices skill
    - web-design-guidelines skill
  stack:
    - Next.js 15
    - React 19
    - Tailwind CSS 4
    - shadcn/ui
    - TypeScript
---

## 1. Validate Input & Initialize

@assert $app_description != ""
@env AGENT_API_KEY

@call shell.exec("echo 'Building Next.js app: $app_description'")
@call shell.exec("date +%s%3N") → $build_start_time

## 2. Generate Project Architecture Plan

@agent copilot: "You are an expert Next.js architect. Based on this app description: '$app_description'. Analyze and create: 1. Complete folder structure (app router pattern), 2. Required components list (if not provided: $components_list), 3. Required pages/routes (if not provided: $pages_list), 4. Data flow architecture, 5. State management strategy, 6. API routes needed. Format response as JSON with: { structure, components, pages, dataFlow, stateManagement, apiRoutes }" → $architecture_plan

@call shell.exec("echo 'Architecture planned: $architecture_plan.components.length components, $architecture_plan.pages.length pages'")

## 3. Create Project Structure

@parallel:

### Setup Base Next.js Config

@agent copilot: "Generate production-ready Next.js 15 config files: next.config.ts (with image optimization, experimental features), tailwind.config.ts (with shadcn/ui presets, custom theme), tsconfig.json (strict mode, path aliases), components.json (shadcn/ui config). Follow Vercel best practices. Return as JSON map of filename -> content." → $config_files

### Generate Package.json

@agent copilot: "Generate package.json for Next.js 15 app with: React 19, Next.js 15, TypeScript, Tailwind CSS 4, shadcn/ui components, Development tools (ESLint, Prettier, TypeScript), Optimization tools (sharp, @vercel/analytics). Include scripts: dev, build, start, lint, type-check. Return as JSON." → $package_json

## 4. Generate UI Components (Parallel)

@if $components_list.length > 0:
@call shell.exec("echo 'Generating $components_list.length components'")

@for $component_name in $components_list:
@parallel:

    ### Design Component (frontend-design skill)
    @agent copilot: "Using frontend-design skill principles:

    Create a production-grade '$component_name' component for Next.js with:
    - TypeScript with strict types
    - Tailwind CSS styling (following shadcn/ui design patterns)
    - Responsive design (mobile-first)
    - Accessibility (ARIA labels, keyboard nav)
    - Props interface with JSDoc
    - Variants using CVA (class-variance-authority)

    Follow shadcn/ui component architecture.
    Return complete component code." → $component_code

    ### Optimize Component (vercel-react-best-practices skill)
    @agent copilot: "Using Vercel React best practices:

    Review and optimize this '$component_name' component for:
    - React Server Components (use 'use client' only if needed)
    - Proper memoization (useMemo, useCallback)
    - Code splitting opportunities
    - Image optimization (next/image)
    - Font optimization (next/font)

    Return optimized code + explanation." → $optimized_component

@else:
@call shell.exec("echo 'Using components from architecture plan'")
@for $component_name in $architecture_plan.components: # Same parallel processing as above
@agent copilot: "Create component: $component_name" → $component_code

## 5. Generate Pages/Routes (Parallel)

@if $pages_list.length > 0:
  @for $page_name in $pages_list:
    @agent copilot: "Create Next.js 15 App Router page for '$page_name': - File: app/$page_name/page.tsx - Server Component by default - Metadata export for SEO - Loading UI (loading.tsx) - Error boundary (error.tsx) - Use generated components - Follow Vercel routing best practices

    Return: page.tsx, loading.tsx, error.tsx, layout.tsx (if custom)" → $page_files

@else:
@for $page_name in $architecture_plan.pages:
@agent copilot: "Create page: $page_name" → $page_files

## 6. Aggregate Generated Code

@call shell.exec("echo 'Aggregating components and pages'")

@for $component in $components_list:
@call shell.exec("echo 'Component: $component'") → $component_entry

@for $page in $pages_list:
@call shell.exec("echo 'Page: $page'") → $page_entry

## 7. Design Review (web-design-guidelines skill)

@agent copilot: "Using Web Interface Guidelines: Review the generated UI for compliance with: 1. Accessibility (WCAG 2.1 AA) - Color contrast ratios, Keyboard navigation, Screen reader support, Focus indicators. 2. Responsive Design - Mobile-first approach, Breakpoint consistency, Touch targets (min 44x44px), Fluid typography. 3. Visual Design - Consistent spacing (Tailwind scale), Typography hierarchy, Color palette harmony, Component variants. 4. UX Best Practices - Clear CTAs, Loading states, Error handling, Empty states. Components to review: $components_list. Pages to review: $pages_list. Return JSON: { score: 0-1, passed: [], failed: [], recommendations: [] }" → $design_review_report

@call shell.exec("echo 'Design review score: $design_review_report.score'")

## 8. Performance Review (vercel-react-best-practices skill)

@agent copilot: "Using Vercel React best practices: Perform performance audit on generated code: 1. Bundle Size - Identify large imports, Suggest code splitting, Recommend dynamic imports. 2. React Optimization - Check unnecessary re-renders, Validate memoization usage, Review Server vs Client components. 3. Next.js Specific - Image optimization opportunities, Font loading strategy, Route prefetching, Static vs dynamic rendering. 4. Core Web Vitals - LCP optimization tips, CLS prevention, FID improvements. Return JSON: { score: 0-1, issues: [], optimizations: [], estimated_improvement: '' }" → $performance_review_report

@call shell.exec("echo 'Performance review score: $performance_review_report.score'")

## 9. Quality Gate Check

@call shell.exec("echo '$(( ($design_review_report.score + $performance_review_report.score) / 2 ))'") → $overall_quality_score

@if $overall_quality_score < $quality_threshold:
  @call shell.exec("echo 'Quality below threshold ($quality_threshold), initiating improvements'")

@agent copilot: "Quality scores: Design: $design_review_report.score, Performance: $performance_review_report.score, Overall: $overall_quality_score, Threshold: $quality_threshold. Issues found: Design: $design_review_report.failed, Performance: $performance_review_report.issues. Provide actionable recommendations to reach threshold: 1. Priority fixes (high impact), 2. Quick wins (low effort), 3. Long-term improvements. Return as JSON array." → $recommendations

@handoff review: "Review and apply these improvements to the generated code: $recommendations. Original design review: $design_review_report. Performance review: $performance_review_report" → $improved_artifacts

@else:
@call shell.exec("echo 'Quality gate passed!'")
@call shell.exec("echo '[]'") → $recommendations

## 10. Generate Supporting Files

@parallel:

### README.md

@agent copilot: "Generate comprehensive README.md for this Next.js app: Project description: $app_description, Tech stack (Next.js 15, React 19, Tailwind, shadcn/ui), Getting started instructions, Project structure, Available scripts, Environment variables needed, Deployment guide (Vercel), Contributing guidelines. Format in Markdown." → $readme_content

### .env.example

@agent copilot: "Generate .env.example with common Next.js env vars: Database URL, API keys placeholders, Feature flags, Analytics tokens. Based on app description: $app_description. Document each variable." → $env_example

### Components Documentation

@agent copilot: "Generate components.md documenting all created components: Component name, Props interface, Usage examples, Variants, Accessibility notes. Components: $components_list" → $components_docs

## 11. Generate Deployment Config

@parallel:

### Vercel Config

@agent copilot: "Generate vercel.json for optimal Vercel deployment: Build configuration, Output directory, Environment variables, Headers (security, caching), Redirects/rewrites (if needed), Edge config. Return JSON config." → $vercel_config

### GitHub Actions CI/CD

@agent copilot: "Generate .github/workflows/ci.yml for: Type checking (tsc), Linting (ESLint), Build test, Preview deployments (Vercel), Production deployments. Use Vercel CLI for deployments." → $github_workflow

## 12. Compute Build Metrics

@call shell.exec("date +%s%3N") → $build_end_time
@call shell.exec("echo $(($build_end_time - $build_start_time))") → $build_time_ms

@call shell.exec("echo 'Build completed in $(($build_time_ms / 1000))s'")
@call shell.exec("echo 'Generated: $components_list.length components, $pages_list.length pages'")

## 13. Prepare Final Output

@call shell.exec("echo 'Preparing final artifacts'")

# Compile all generated files into structured output

@for $component in $components_list:
  @call shell.exec("echo '{\"name\": \"$component\", \"path\": \"components/$component.tsx\", \"type\": \"component\"}'") → $component_artifact

@for $page in $pages_list:
  @call shell.exec("echo '{\"name\": \"$page\", \"path\": \"app/$page/page.tsx\", \"type\": \"page\"}'") → $page_artifact

## 14. Declare Outputs

@output: $component_artifact, $page_artifact, $design_review_report, $performance_review_report, $recommendations

````

## Usage

```bash
# Example 1: E-commerce Dashboard
chainskills run nextjs-app-builder.workflow.md \
  --input app_description="E-commerce admin dashboard with product management, order tracking, and analytics" \
  --input components_list='["DataTable", "ProductCard", "OrderStatus", "AnalyticsChart", "SearchBar"]' \
  --input pages_list='["dashboard", "products", "orders", "analytics", "settings"]'

# Example 2: SaaS Landing Page
chainskills run nextjs-app-builder.workflow.md \
  --input app_description="SaaS landing page with hero, features, pricing, testimonials, and CTA" \
  --input components_list='["Hero", "FeatureCard", "PricingTable", "Testimonial", "CTA"]' \
  --input pages_list='["home", "pricing", "about", "contact"]'

# Example 3: AI-powered Architecture (no predefined components)
chainskills run nextjs-app-builder.workflow.md \
  --input app_description="Portfolio website for a photographer with gallery, about page, and contact form"
  # Agent will auto-generate components and pages based on description
````

## Skills Chained

1. **frontend-design** — Create distinctive, production-grade components
2. **vercel-react-best-practices** — Optimize for performance
3. **web-design-guidelines** — Review UI compliance
4. **Agent: copilot** — Architecture, code generation, reviews
5. **Agent: review** — Quality gate improvements (handoff)

## Expected Output Structure

```
project/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx          # Server Component
│   │   ├── loading.tsx       # Loading UI
│   │   └── error.tsx         # Error boundary
│   ├── products/
│   │   └── page.tsx
│   └── layout.tsx            # Root layout
├── components/
│   ├── ui/                   # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── DataTable.tsx         # Custom components
│   ├── ProductCard.tsx
│   └── ...
├── lib/
│   └── utils.ts             # Utility functions
├── public/
│   └── assets/
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions
├── components.json          # shadcn/ui config
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── vercel.json
├── README.md
├── COMPONENTS.md            # Component docs
└── .env.example
```

## Quality Reports

### Design Review Report

```json
{
  "score": 0.92,
  "passed": [
    "Color contrast WCAG AA compliant",
    "Keyboard navigation implemented",
    "Responsive breakpoints consistent",
    "Touch targets meet 44x44px minimum"
  ],
  "failed": ["Missing focus indicators on 2 components"],
  "recommendations": [
    "Add visible focus rings using Tailwind ring utilities",
    "Test with screen reader for ARIA labels"
  ]
}
```

### Performance Review Report

```json
{
  "score": 0.88,
  "issues": [
    "Large icon library imported in 3 components (increases bundle)",
    "Client component used where Server Component would work"
  ],
  "optimizations": [
    "Use dynamic imports for heavy components",
    "Convert ProductCard to Server Component",
    "Use next/image for all images"
  ],
  "estimated_improvement": "Reduce initial bundle by ~45KB, improve LCP by 200ms"
}
```

## Workflow Visualization

```
                    ┌──────────────────────┐
                    │  1. Validate Input   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  2. Agent: Generate  │
                    │     Architecture     │
                    └──────────┬───────────┘
                               │
                    ╔══════════▼═══════════╗
                    ║  3. Parallel Setup   ║
                    ╚═══════════╩══════════╝
                    ┌───────────┬──────────┐
                    │           │          │
          ┌─────────▼────┐  ┌──▼────┐  ┌──▼────────┐
          │ Next Config  │  │ Pkg   │  │ TS Config │
          └─────────┬────┘  └──┬────┘  └──┬────────┘
                    └───────────┴──────────┘
                               │
                    ╔══════════▼═══════════╗
                    ║  4. Generate         ║
                    ║     Components       ║
                    ║     (Parallel Loop)  ║
                    ╚═══════════╩══════════╝
                    ┌───────────┬──────────┐
          ┌─────────▼────┐  ┌──▼──────────────┐
          │ frontend-    │  │ vercel-react-   │
          │ design skill │  │ practices skill │
          └─────────┬────┘  └──┬──────────────┘
                    └───────────┘
                               │
                    ╔══════════▼═══════════╗
                    ║  5. Generate Pages   ║
                    ║     (Parallel Loop)  ║
                    ╚═══════════╩══════════╝
                               │
                    ╔══════════▼═══════════╗
                    ║  7-8. Reviews        ║
                    ║      (Parallel)      ║
                    ╚═══════════╩══════════╝
                    ┌───────────┬──────────┐
          ┌─────────▼────────┐  ┌▼─────────────────┐
          │ web-design-      │  │ vercel-react-    │
          │ guidelines skill │  │ practices skill  │
          └─────────┬────────┘  └┬─────────────────┘
                    └─────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  9. Quality Gate     │
                    └──────────┬───────────┘
                               │
                        ┌──────▼──────┐
                        │  < threshold? │
                        └──────┬──────┘
                         YES ← │ → NO
                          │         │
                    ┌─────▼─────┐   │
                    │ @handoff  │   │
                    │  review   │   │
                    └─────┬─────┘   │
                          └─────────┘
                               │
                    ╔══════════▼═══════════╗
                    ║  10-11. Supporting   ║
                    ║        Files         ║
                    ║      (Parallel)      ║
                    ╚═══════════╩══════════╝
                               │
                    ┌──────────▼───────────┐
                    │  14. Declare Outputs │
                    └──────────────────────┘
```

## Next Steps After Running

1. **Initialize project**

   ```bash
   mkdir my-nextjs-app && cd my-nextjs-app
   pnpm init
   ```

2. **Copy generated files** from workflow output to project

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Install shadcn/ui components**

   ```bash
   pnpm dlx shadcn@latest init
   pnpm dlx shadcn@latest add button card input
   ```

5. **Run development server**

   ```bash
   pnpm dev
   ```

6. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

## Extending the Workflow

### Add Database Integration

```markdown
## Add Database Setup

@agent copilot: "Generate Prisma schema for: $app_description.
Include: User model, relations, indexes." → $prisma_schema
```

### Add API Routes

```markdown
## Generate API Routes

@for $api_route in $architecture_plan.apiRoutes:
@agent copilot: "Create Next.js API route: $api_route

- File: app/api/$api_route/route.ts
- TypeScript with Zod validation
- Error handling
- Rate limiting" → $api_file
```

### Add Testing

```markdown
## Generate Tests

@agent copilot: "Generate Vitest tests for components:

- Unit tests for components
- Integration tests for pages
- E2E tests with Playwright" → $test_files
```

## Production Checklist

Before deploying:

- [ ] All components have TypeScript types
- [ ] Accessibility score > 0.85
- [ ] Performance score > 0.85
- [ ] Environment variables documented
- [ ] README.md complete
- [ ] Error boundaries in place
- [ ] Loading states implemented
- [ ] SEO metadata configured
- [ ] Analytics integrated
- [ ] Vercel config tested
