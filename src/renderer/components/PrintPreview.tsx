import { useRef } from 'react'
import { Printer, X } from 'lucide-react'
import Button from './Button'
import Modal from './Modal'
import { useReactToPrint } from 'react-to-print'

interface PrintPreviewProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export default function PrintPreview({ isOpen, onClose, children, title = 'Preview' }: PrintPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    content: () => contentRef.current,
    pageStyle: `
      @page {
        size: auto;
        margin: 0mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        * {
          overflow: visible !important;
        }
      }
    `,
  })

  return (
    <Modal open={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="max-h-[60vh] overflow-y-auto border border-gray-300 rounded-lg p-4 bg-white">
          <div ref={contentRef}>
            {children}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handlePrint} icon={<Printer size={16} />} className="flex-1">
            Cetak
          </Button>
          <Button variant="secondary" onClick={onClose} icon={<X size={16} />} className="flex-1">
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  )
}
