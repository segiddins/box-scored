import * as React from "react";
import { SpeakerphoneIcon, XIcon } from "@heroicons/react/outline";
import classNames from "classnames";

export type AlertProps = {
  //   variant?: Variant;
  variant: "info" | "warning" | "error";
  LeftIcon?: React.FC<React.ComponentProps<"svg">>;
  dismissible?: boolean;
  closeLabel?: string;
  //   transition?: TransitionType;
  action?: React.ReactNode;
  children?: React.ReactNode;
};
export const Alert = ({
  variant,
  dismissible = true,
  closeLabel = "Dismiss",
  LeftIcon = SpeakerphoneIcon,
  action = null,
  children,
}: AlertProps) => {
  const [show, setShow] = React.useState(true);
  if (!show) return null;

  const colorClassNames = {
    info: "bg-indigo-400",
    warning: "bg-yellow-500",
    error: "bg-red-400",
  };
  const iconBGClassNames = {
    info: "bg-indigo-700",
    warning: "bg-yellow-800",
    error: "bg-red-700",
  };
  const buttonTextClassNames = {
    info: "text-indigo-500",
    warning: "text-yellow-600",
    error: "text-red-500",
  };

  return (
    <div className={`${colorClassNames[variant]} mb-3`}>
      <div className="mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            {LeftIcon && (
              <span
                className={`flex p-2 rounded-lg ${iconBGClassNames[variant]}`}
              >
                <LeftIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </span>
            )}
            <p className="ml-3 font-medium text-white truncate">{children}</p>
          </div>
          {action && (
            <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
              <span
                className={`flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium ${buttonTextClassNames[variant]} bg-white hover:bg-indigo-50`}
              >
                {action}
              </span>
            </div>
          )}
          {dismissible && (
            <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
              <button
                type="button"
                className="-mr-1 flex p-2 rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2"
                onClick={() => setShow(false)}
              >
                <span className="sr-only">{closeLabel}</span>
                <XIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type CardProps = { children: React.ReactNode };
const CardI = ({ children }: CardProps) => {
  return (
    <div className="shadow-md rounded-md p-2 border-gray-400 border-opacity-70 border-solid border">
      <div className="p-2">{children}</div>
    </div>
  );
};
const CardTitle = ({ children }: { children: React.ReactNode }) => {
  return (
    <h3 className="text-lg leading-6 font-semibold text-gray-900 text-center">
      {children}
    </h3>
  );
};
const CardBody = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-white px-2 py-1">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-1 mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
          {children}
        </div>
      </div>
    </div>
  );
};
const CardText = ({ children }: { children: React.ReactNode }) => {
  return <div className="mt-2 text-sm text-gray-500">{children}</div>;
};
const CardActions = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="sm:flex sm:flex-wrap sm:items-center sm:justify-items-center justify-center">
      {children}
    </div>
  );
};
const CardAction = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: React.ButtonHTMLAttributes<unknown>["onClick"];
}) => {
  return (
    <button
      className="bg-purple-500 text-white active:bg-purple-600 font-bold uppercase text-xs px-4 py-2 rounded shadow-sm hover:shadow-md outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export const Card = {
  Card: CardI,
  Title: CardTitle,
  Body: CardBody,
  Text: CardText,
  Actions: CardActions,
  Action: CardAction,
};

type OneOrArray<T> = T | T[];
type ColumnBuilderProps<T> = {
  header?: React.ReactNode;
  children: (arg0: T) => React.ReactNode;
};
const ColumnBuilder = <T extends unknown>({
  header,
  children,
}: ColumnBuilderProps<T>) => {
  return { header, builder: children };
};
// class ColumnBuilder<T> extends React.Component<ColumnBuilderProps<T>> {
//   // Renderless component.
//   render() {
//     return this.props;
//   }
// }

type TableProps<T> = {
  data: T[];
  columns: OneOrArray<{
    header: React.ReactNode;
    builder: (arg0: T) => React.ReactNode;
  }>;
  row?: (arg0: T) => Omit<React.HTMLProps<HTMLTableRowElement>, "children">;
  ifEmpty?: React.ReactNode;
} & Omit<
  React.DetailedHTMLProps<
    React.TableHTMLAttributes<HTMLTableElement>,
    HTMLTableElement
  >,
  "children"
>;

const TableI = <T extends unknown>({
  data,
  columns,
  ifEmpty = undefined,
  row = () => {
    return {
      className: classNames(
        "table-row",
        "border-b",
        "border-gray-300",
        "align-text-top"
      ),
    };
  },
  ...rest
}: TableProps<T>) => {
  if (data.length === 0 && ifEmpty) {
    return <>{ifEmpty}</>;
  }

  const builders = Array.isArray(columns) ? columns : [columns];

  return (
    <table className={classNames("table", "border-collapse")} {...rest}>
      <thead className={classNames("table-header-group")}>
        {builders.map((cb, idx) => (
          <th key={idx}>{cb.header}</th>
        ))}
      </thead>
      <tbody className={classNames("table-row-group")}>
        {data.map((elt, idx) => (
          <tr key={idx} {...row(elt)}>
            {builders.map((builder, idx) => (
              <td key={idx}>{builder.builder(elt)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const Table = {
  Table: TableI,
  Column: ColumnBuilder,
};
