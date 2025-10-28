import * as React from 'react';

type TableProps = React.HTMLAttributes<HTMLTableElement>;
type TableSectionProps = React.HTMLAttributes<HTMLTableSectionElement>;
type TableRowProps = React.HTMLAttributes<HTMLTableRowElement>;
type TableHeadCellProps = React.ThHTMLAttributes<HTMLTableCellElement>;
type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table ref={ref} className={`w-full caption-bottom text-sm ${className}`} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className = '', ...props }, ref) => (
    <thead ref={ref} className={`[&_tr]:border-b ${className}`} {...props} />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className = '', ...props }, ref) => (
    <tbody ref={ref} className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className = '', ...props }, ref) => (
    <tr
      ref={ref}
      className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${className}`}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadCellProps>(
  ({ className = '', ...props }, ref) => (
    <th
      ref={ref}
      className={`h-10 px-4 text-center align-middle text-nowrap font-medium text-muted-foreground ${className}`}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className = '', ...props }, ref) => (
    <td ref={ref} className={`p-4 align-middle text-center ${className}`} {...props} />
  )
);
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className = '', ...props }, ref) => (
  <caption ref={ref} className={`mt-4 text-sm text-muted-foreground ${className}`} {...props} />
));
TableCaption.displayName = 'TableCaption';
