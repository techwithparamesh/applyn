import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "wouter";

type Product = {
  id: string;
  appId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currency: string;
  priceCents: number;
  active: number;
  createdAt: string;
  updatedAt: string;
};

type Order = {
  id: string;
  appId: string;
  customerId: string | null;
  status: string;
  currency: string;
  totalCents: number;
  paymentProvider: string | null;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
};

export default function StoreAdmin() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const productsQ = useQuery<Product[]>({
    queryKey: ["/api/apps", id, "admin/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const ordersQ = useQuery<Order[]>({
    queryKey: ["/api/apps", id, "admin/orders"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const [name, setName] = useState("");
  const [price, setPrice] = useState("199");
  const [currency, setCurrency] = useState("INR");

  const createProduct = useMutation({
    mutationFn: async () => {
      const priceCents = Math.max(0, Math.round(Number(price) * 100));
      const res = await apiRequest("POST", `/api/apps/${id}/admin/products`, {
        name,
        priceCents,
        currency,
        active: true,
      });
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: () => {
      setName("");
      setPrice("199");
      toast({ title: "Product created" });
      queryClient.invalidateQueries({ queryKey: ["/api/apps", id, "admin/products"] });
    },
    onError: (err: any) => toast({ title: "Create failed", description: err?.message }),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      await apiRequest("PATCH", `/api/apps/${id}/admin/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Order updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/apps", id, "admin/orders"] });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err?.message }),
  });

  const productRows = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const orderRows = useMemo(() => ordersQ.data ?? [], [ordersQ.data]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 space-y-10">
        <Card>
          <CardHeader>
            <CardTitle>Store Admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="font-medium">Create product</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300/80">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chicken Biryani" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300/80">Price</Label>
                  <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="199" />
                  <div className="text-xs text-muted-foreground">Entered as major units (e.g. 199 = ₹199)</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300/80">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => createProduct.mutate()} disabled={!name || createProduct.isPending}>
                Create
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="font-medium">Products</div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs text-slate-300/80">Name</TableHead>
                      <TableHead className="text-xs text-slate-300/80">Price</TableHead>
                      <TableHead className="text-xs text-slate-300/80">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productRows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          {(Number(p.priceCents) / 100).toFixed(2)} {p.currency}
                        </TableCell>
                        <TableCell>{p.active ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                    {!productRows.length && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          {productsQ.isLoading ? "Loading…" : "No products yet"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="font-medium">Orders</div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs text-slate-300/80">Order</TableHead>
                      <TableHead className="text-xs text-slate-300/80">Total</TableHead>
                      <TableHead className="text-xs text-slate-300/80">Status</TableHead>
                      <TableHead className="text-xs text-slate-300/80">Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderRows.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id}</TableCell>
                        <TableCell>
                          {(Number(o.totalCents) / 100).toFixed(2)} {o.currency}
                        </TableCell>
                        <TableCell className="space-y-2">
                          <div className="text-xs font-medium text-slate-300/80">Current: {o.status}</div>
                          <Select
                            value={o.status}
                            onValueChange={(status) => updateOrder.mutate({ orderId: o.id, status })}
                          >
                            <SelectTrigger className="w-[220px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="created">created</SelectItem>
                              <SelectItem value="accepted">accepted</SelectItem>
                              <SelectItem value="preparing">preparing</SelectItem>
                              <SelectItem value="out_for_delivery">out_for_delivery</SelectItem>
                              <SelectItem value="delivered">delivered</SelectItem>
                              <SelectItem value="cancelled">cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {o.paymentProvider ?? "-"} / {o.paymentStatus}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!orderRows.length && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          {ordersQ.isLoading ? "Loading…" : "No orders yet"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
