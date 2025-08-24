/**
 * EML/PDFアップロード検証モード
 * ドラッグ&ドロップでローカル解析→既存パイプに流すテスト機能
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  LinearProgress,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Email as EmailIcon,
  PictureAsPdf as PdfIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { gmailService, CreditTransaction } from '../services/gmailService';
import { merchantClassifier } from '../services/merchantClassifier';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: CreditTransaction | null;
  error?: string;
  processingTime?: number;
  rawData?: any; // デバッグ用の生データ
}

interface FileUploadTesterProps {
  onTransactionsDetected?: (transactions: CreditTransaction[]) => void;
}

const FileUploadTester: React.FC<FileUploadTesterProps> = ({ onTransactionsDetected }) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      if (file.type === 'message/rfc822' || file.name.endsWith('.eml') || file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const uploadedFile: UploadedFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type || (file.name.endsWith('.eml') ? 'message/rfc822' : 'application/pdf'),
          content: '',
          status: 'pending'
        };

        setUploadedFiles(prev => [...prev, uploadedFile]);

        // ファイル読み込み
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          uploadedFile.content = content;

          // ファイル処理を開始
          await processUploadedFile(uploadedFile);
        };

        reader.readAsText(file);
      }
    });
  };

  const processUploadedFile = async (file: UploadedFile) => {
    const startTime = Date.now();

    setUploadedFiles(prev => prev.map(f => 
      f.id === file.id ? { ...f, status: 'processing' } : f
    ));

    try {
      let result: CreditTransaction | null = null;

      if (file.type === 'message/rfc822' || file.name.endsWith('.eml')) {
        // EMLファイルの処理
        result = await processEMLFile(file);
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // PDFファイルの処理
        result = await processPDFFile(file);
      }

      const processingTime = Date.now() - startTime;

      setUploadedFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { 
              ...f, 
              status: result ? 'success' : 'error',
              result,
              processingTime,
              error: result ? undefined : '取引情報を検出できませんでした'
            } 
          : f
      ));

      // 成功した取引を親コンポーネントに通知
      if (result && onTransactionsDetected) {
        onTransactionsDetected([result]);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;

      setUploadedFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { 
              ...f, 
              status: 'error',
              error: error instanceof Error ? error.message : '処理中にエラーが発生しました',
              processingTime
            } 
          : f
      ));
    }
  };

  const processEMLFile = async (file: UploadedFile): Promise<CreditTransaction | null> => {
    try {
      // EMLファイル内容をパース
      const emlContent = file.content;
      const headers: { [key: string]: string } = {};
      let body = '';
      let inHeader = true;

      const lines = emlContent.split('\n');
      for (const line of lines) {
        if (inHeader) {
          if (line.trim() === '') {
            inHeader = false;
            continue;
          }
          const match = line.match(/^([^:]+):\s*(.+)$/);
          if (match) {
            headers[match[1].toLowerCase()] = match[2];
          }
        } else {
          body += line + '\n';
        }
      }

      // EmailDataオブジェクトを構築
      const emailData = {
        id: file.id,
        subject: headers['subject'] || '',
        body: body.trim(),
        date: headers['date'] || new Date().toISOString(),
        from: headers['from'] || ''
      };

      // 既存のパイプラインで解析
      const result = await gmailService.parseCreditNotification(emailData);
      
      // デバッグ情報を保存
      file.rawData = {
        headers,
        bodyPreview: body.substring(0, 500),
        extractedInfo: {
          subject: emailData.subject,
          from: emailData.from,
          bodyLength: body.length
        }
      };

      return result;
    } catch (error) {
      throw new Error(`EMLファイル処理エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const processPDFFile = async (file: UploadedFile): Promise<CreditTransaction | null> => {
    // PDFファイルの処理は簡略版（テキスト抽出の代替）
    try {
      // 実際の実装では PDF.js などを使用してテキスト抽出
      // ここでは仮実装として警告を出す
      throw new Error('PDFファイルの処理は現在サポートされていません。EMLファイルをご利用ください。');
    } catch (error) {
      throw error;
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const showDetails = (file: UploadedFile) => {
    setSelectedFile(file);
    setDetailModalOpen(true);
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
  };

  const getSuccessfulTransactions = (): CreditTransaction[] => {
    return uploadedFiles
      .filter(f => f.status === 'success' && f.result)
      .map(f => f.result!)
      .filter(Boolean);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'processing':
        return <LinearProgress sx={{ width: '20px' }} />;
      default:
        return <InfoIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'processing':
        return 'warning';
      default:
        return 'default';
    }
  };

  const successfulFiles = uploadedFiles.filter(f => f.status === 'success').length;
  const errorFiles = uploadedFiles.filter(f => f.status === 'error').length;
  const processingFiles = uploadedFiles.filter(f => f.status === 'processing').length;

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📧 EMLファイルアップロード検証モード
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            クレジットカードの利用通知メール（.eml）をドラッグ&ドロップしてテストできます。
            Gmailなしでも取引解析パイプラインをテストできます。
          </Typography>

          {/* ドラッグ&ドロップエリア */}
          <Paper
            sx={{
              p: 4,
              mb: 2,
              textAlign: 'center',
              border: '2px dashed',
              borderColor: isDragging ? 'primary.main' : 'grey.400',
              bgcolor: isDragging ? 'primary.50' : 'grey.50',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'primary.50'
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              {isDragging ? 'ファイルをドロップしてください' : 'EMLファイルをドラッグ&ドロップ'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              または クリックしてファイルを選択
            </Typography>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept=".eml,message/rfc822,.pdf"
              multiple
              style={{ display: 'none' }}
            />
          </Paper>

          {/* 統計表示 */}
          {uploadedFiles.length > 0 && (
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={3}>
                <Chip
                  icon={<InfoIcon />}
                  label={`合計: ${uploadedFiles.length}`}
                  size="small"
                />
              </Grid>
              <Grid item xs={3}>
                <Chip
                  icon={<CheckIcon />}
                  label={`成功: ${successfulFiles}`}
                  color="success"
                  size="small"
                />
              </Grid>
              <Grid item xs={3}>
                <Chip
                  icon={<ErrorIcon />}
                  label={`エラー: ${errorFiles}`}
                  color="error"
                  size="small"
                />
              </Grid>
              <Grid item xs={3}>
                <Chip
                  label={`処理中: ${processingFiles}`}
                  color="warning"
                  size="small"
                />
              </Grid>
            </Grid>
          )}

          {/* アクションボタン */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            {uploadedFiles.length > 0 && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DeleteIcon />}
                onClick={clearAllFiles}
                size="small"
              >
                全削除
              </Button>
            )}
            {getSuccessfulTransactions().length > 0 && onTransactionsDetected && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => onTransactionsDetected(getSuccessfulTransactions())}
                size="small"
              >
                検出された取引をメインに送信
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* アップロードされたファイル一覧 */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              処理結果
            </Typography>
            
            <List>
              {uploadedFiles.map((file, index) => (
                <React.Fragment key={file.id}>
                  <ListItem>
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                      {file.name.endsWith('.eml') ? <EmailIcon /> : <PdfIcon />}
                    </Box>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1">{file.name}</Typography>
                          <Chip
                            label={file.status}
                            color={getStatusColor(file.status) as any}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            {formatFileSize(file.size)}
                            {file.processingTime && ` • 処理時間: ${file.processingTime}ms`}
                          </Typography>
                          {file.result && (
                            <Typography variant="body2" color="success.main">
                              ✓ {file.result.merchant} - {file.result.amount.toLocaleString()}円
                            </Typography>
                          )}
                          {file.error && (
                            <Typography variant="body2" color="error.main">
                              ✗ {file.error}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<ViewIcon />}
                          onClick={() => showDetails(file)}
                        >
                          詳細
                        </Button>
                        <Button
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={() => removeFile(file.id)}
                          color="secondary"
                        >
                          削除
                        </Button>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < uploadedFiles.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* 詳細モーダル */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        {selectedFile && (
          <>
            <DialogTitle>
              ファイル詳細: {selectedFile.name}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">ファイル情報</Typography>
                  <Typography variant="body2">
                    サイズ: {formatFileSize(selectedFile.size)}<br/>
                    タイプ: {selectedFile.type}<br/>
                    ステータス: {selectedFile.status}<br/>
                    {selectedFile.processingTime && `処理時間: ${selectedFile.processingTime}ms`}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  {selectedFile.result && (
                    <>
                      <Typography variant="subtitle2">解析結果</Typography>
                      <Typography variant="body2">
                        店舗名: {selectedFile.result.merchant}<br/>
                        金額: {selectedFile.result.amount.toLocaleString()}円<br/>
                        日付: {selectedFile.result.date}<br/>
                        カテゴリ: {selectedFile.result.category}<br/>
                        ステータス: {selectedFile.result.status}
                      </Typography>
                    </>
                  )}
                </Grid>
              </Grid>

              {selectedFile.rawData && (
                <Accordion sx={{ mt: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">デバッグ情報</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box component="pre" sx={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: '300px' }}>
                      {JSON.stringify(selectedFile.rawData, null, 2)}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {selectedFile.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {selectedFile.error}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailModalOpen(false)}>
                閉じる
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default FileUploadTester;