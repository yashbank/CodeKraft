import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_ENUMS, TONES, type StatusEnum, type StatusValue } from "@/lib/status-tone";
import { Row, Section } from "./_section";

const ROWS = [
  { no: "CK-ORD-000001", product: "FitDesk Pro", amount: "₹7,999.00", status: "paid" },
  { no: "CK-ORD-000002", product: "TradeFlow", amount: "₹24,999.00", status: "pending_payment" },
  { no: "CK-ORD-000003", product: "MIS Portal", amount: "₹1,20,000.00", status: "fulfilled" },
] as const;

export function DataSection() {
  return (
    <Section
      id="data"
      title="Data display"
      description="docs/08 §6.4–§6.8 — cards, table, badges, tabs, accordion, progress, skeleton, avatar, breadcrumb, pagination."
    >
      <Row label="badges">
        {TONES.map((t) => (
          <Badge key={t} tone={t}>
            {t}
          </Badge>
        ))}
      </Row>
      <Row label="card">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>FitDesk Pro</CardTitle>
            <CardDescription>SaaS · monthly from ₹999</CardDescription>
          </CardHeader>
          <CardContent>Product card body uses surface and border tokens.</CardContent>
        </Card>
      </Row>
      <Row label="table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((r) => (
              <TableRow key={r.no}>
                <TableCell className="font-mono">{r.no}</TableCell>
                <TableCell>{r.product}</TableCell>
                <TableCell>{r.amount}</TableCell>
                <TableCell>
                  <StatusBadge kind="orders.status" value={r.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Row>
      <Row label="tabs">
        <Tabs defaultValue="basics" className="w-full max-w-md">
          <TabsList>
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="offerings">Offerings</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>
          <TabsContent value="basics">Product basics tab.</TabsContent>
          <TabsContent value="offerings">Offerings tab.</TabsContent>
          <TabsContent value="seo">SEO tab.</TabsContent>
        </Tabs>
      </Row>
      <Row label="accordion">
        <Accordion type="single" collapsible className="w-full max-w-md">
          <AccordionItem value="a">
            <AccordionTrigger>Is the source code included?</AccordionTrigger>
            <AccordionContent>Depends on the offering's delivery type.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Row>
      <Row label="progress">
        <Progress value={66} className="w-64" aria-label="Checklist progress" />
      </Row>
      <Row label="skeleton">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="size-10 rounded-full" />
      </Row>
      <Row label="avatar">
        <Avatar>
          <AvatarFallback>CK</AvatarFallback>
        </Avatar>
      </Row>
      <Row label="separator">
        <Separator className="w-64" />
      </Row>
      <Row label="breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/products">Products</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>FitDesk Pro</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Row>
      <Row label="pagination">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#data" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#data" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#data">2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#data" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Row>
    </Section>
  );
}

export function StatusMatrixSection() {
  const enums = Object.keys(STATUS_ENUMS) as StatusEnum[];
  return (
    <Section
      id="status"
      title="Status badges"
      description="docs/08 §6.8 — every enum value in docs/05 mapped to a tone."
    >
      {enums.map((e) => (
        <Row key={e} label={e}>
          {(STATUS_ENUMS[e] as readonly string[]).map((v) => (
            <StatusBadge key={v} kind={e} value={v as StatusValue<typeof e>} />
          ))}
        </Row>
      ))}
    </Section>
  );
}
