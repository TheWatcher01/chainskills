---
name: cross-reference
version: 1.0.0
domain: data
difficulty: medium
description: "Cross-reference data from two sources"
---

# Step 1 — Source A
@call shell.exec(echo "ID,Name,Dept\n1,Alice,Engineering\n2,Bob,Marketing\n3,Charlie,Engineering") → $employees

# Step 2 — Source B
@call shell.exec(echo "EmpID,Project,Hours\n1,Alpha,120\n1,Beta,80\n2,Alpha,40\n4,Gamma,60") → $assignments

# Step 3 — Cross-reference
@agent copilot Cross-reference these datasets. Find: employees with no projects, projects with unknown employees, and total hours per employee. Format as a structured report: Employees: $employees Assignments: $assignments → $report

# Step 4 — Output
@output report = $report
