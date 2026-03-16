/**
 * Verification Log Page - List of all imported Certified Execution Records
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import { useJsonLd, buildWebPage, buildBreadcrumbs } from '@/hooks/useJsonLd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  FileJson,
  ExternalLink,
  Hash,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { listAuditRecords } from '@/api/auditRecords';
import { AuditEntryPanel } from './AuditEntryPanel';
import type { AuditRecordRow, RenderStatus } from '@/types/auditRecord';
import { formatDistanceToNow } from 'date-fns';

export function AuditLogPage() {
  const navigate = useNavigate();

  useSEO({
    title: 'Verification Log — NexArt Verification Portal',
    description: 'Browse previously verified Certified Execution Records (CERs). Review verification status, certificate hashes, and attestation details.',
    path: '/audit-log',
  });

  useJsonLd([
    buildWebPage({
      name: 'Verification Log',
      description: 'Log of verified Certified Execution Records on the NexArt verification portal.',
      path: '/audit-log',
    }),
    buildBreadcrumbs([
      { name: 'Verification Portal', path: '/' },
      { name: 'Verification Log', path: '/audit-log' },
    ]),
  ]);
  const [records, setRecords] = useState<AuditRecordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await listAuditRecords({ limit: 100 });
      setRecords(data);
    } catch (error) {
      console.error('Failed to load audit records:', error);
      toast.error('Failed to load verification log');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleRowClick = (record: AuditRecordRow) => {
    navigate(`/audit/${record.certificate_hash}`);
  };

  const getStatusBadge = (status: RenderStatus | null, certificateVerified: boolean) => {
    if (!certificateVerified) {
      return <Badge variant="destructive">INVALID</Badge>;
    }
    
    switch (status) {
      case 'VERIFIED':
        return <Badge className="bg-verified text-verified-foreground">VERIFIED</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">RENDER_FAILED</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">PENDING</Badge>;
      case 'SKIPPED':
        return <Badge variant="outline">SEALED</Badge>;
      default:
        return <Badge variant="outline">SEALED</Badge>;
    }
  };

  const truncateHash = (hash: string, chars = 8) => {
    if (hash.length <= chars * 2) return hash;
    return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verification Log</h1>
          <p className="text-muted-foreground">
            Browse and verify imported Certified Execution Records
          </p>
        </div>
        <Button variant="outline" onClick={loadRecords} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Entry Panel */}
      <AuditEntryPanel />

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            Records ({records.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <AlertTriangle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No records yet</p>
              <p className="text-sm text-muted-foreground">Import a bundle using the panel above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Certificate Hash</TableHead>
                    <TableHead className="hidden sm:table-cell">Imported</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow 
                      key={record.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(record)}
                    >
                      <TableCell>
                        {getStatusBadge(record.render_status, record.certificate_verified)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate font-medium">
                          {record.title || 'Untitled'}
                        </div>
                        {record.statement && (
                          <div className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {record.statement}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="capitalize">
                          {record.claim_type || record.mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <code className="text-xs font-mono text-muted-foreground">
                          {truncateHash(record.certificate_hash)}
                        </code>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
