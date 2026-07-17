import type { RadarAnswer, RadarAxis, RadarNodeAnswer } from "../types";

export interface RadarValidationIssues {
  untouched: string[];
  emptyChildren: string[];
}

export function validateRadarAnswer(
  answer: RadarAnswer,
  axes: RadarAxis[],
  min: number
): RadarValidationIssues {
  const out: RadarValidationIssues = { untouched: [], emptyChildren: [] };

  const checkNode = (node: RadarNodeAnswer | undefined, axis: RadarAxis) => {
    if (!node || !node._touched) return;

    if (node._ > min) {
      const childAxes = axis.children && axis.children.length > 0
        ? axis.children
        : (axis.subCriteria || []).map(label => ({ label } as RadarAxis));

      if (childAxes.length > 0) {
        const childrenNodes = childAxes.map(childAxis => ({
          axis: childAxis,
          node: node.children?.[childAxis.label],
        }));

        const anyChildAboveMin = childrenNodes.some(child => (child.node?._ ?? min) > min);

        if (!anyChildAboveMin) {
          out.emptyChildren.push(axis.label);
        } else {
          for (const child of childrenNodes) {
            if (child.node && child.node._ > min) {
              checkNode(child.node, child.axis);
            }
          }
        }
      }
    }
  };

  for (const axis of axes) {
    const node = answer[axis.label];
    if (!node || !node._touched) {
      out.untouched.push(axis.label);
    } else {
      checkNode(node, axis);
    }
  }

  return out;
}
