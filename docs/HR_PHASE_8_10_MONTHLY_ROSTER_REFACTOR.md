# HR Phase 8-10 - Refactor Danh Sach Nhan Su Thang

Cap nhat: 2026-07-27

Trang thai: **Phase 8 dang duoc trien khai o source theo rule moi: danh sach thang la so lieu song theo ngay hieu luc, khong con flow chot/mo thang tren UI. Chua deploy, chua restart production va chua sua du lieu runtime.**

## 1. Quyet dinh nghiep vu moi

Tu 2026-07-27, flow danh sach thang HR doi sang cach tinh don gian hon cho TCHC:

- Danh sach thang bat dau tu `T6-26`.
- Thang hien tai tu dong xuat hien, khong can Manager bam tao thang.
- Khong con thao tac `Mo ky`, `Chot thang`, `Mo lai` tren giao dien Manager.
- Danh sach thang dai dien cho quan so tinh den **cuoi thang**.
- Tang nhan su hieu luc trong thang nao thi tinh vao thang do va cac thang sau.
- Giam nhan su hieu luc trong thang nao thi loai khoi thang do va cac thang sau.
- Export thang/nam luon dung cung so lieu dang hien thi tren UI.

Vi du:

```text
Truoc khi nhap giam:
T5 = 339
T6 = 338
T7 = 336

Nhap them 1 giam nhan su hieu luc trong T5:
T5 = 338
T6 = 337
T7 = 335
```

Trong he thong hien tai, flow van bat dau tu `T6-26`; vi du T5 chi dung de giai thich cach lan truyen so lieu.

## 2. Nguyen tac sua/xoa bien dong

Huong chon cho cau hoi "neu nhap sai thi sao":

- Bien dong `DRAFT`: duoc sua/huy/xoa theo guard hien co.
- Bien dong da `CONFIRMED`: **khong xoa cung**.
- Neu da xac nhan sai, se xu ly bang nghiep vu dieu chinh/dao chieu co audit o phase tiep theo.
- Muc tieu la giu duoc lich su ai lam, lam luc nao, ly do gi; khong tao khoang trong du lieu HR.

Ly do: HR la du lieu lich su. Neu xoa thang bien dong da xac nhan, sau nay rat kho giai thich vi sao so T6/T7 thay doi.

## 3. Phase 8 - Projection danh sach thang song

### 3.1. Muc tieu

Backend tinh danh sach thang tu:

1. Snapshot baseline `T6-26`.
2. Cac movement `INCREASE`, `DECREASE`, `REHIRE` da `CONFIRMED`.
3. `effective_date` cua movement.

Frontend khong tu cong/tru quan so.

### 3.2. Source da trien khai trong luot nay

- Them `HrRosterProjectionService`.
- `/api/v1/hr/rosters` tra cac thang tu baseline den thang hien tai.
- Neu DB chua co row roster cua thang hien tai, API van tra synthetic period id dang `period-YYYY-MM-01`.
- `/api/v1/hr/rosters/{id}` va `/items` tra item/count duoc tinh dong.
- Projection cua T6 va cac thang sau duoc tinh lai theo movement da xac nhan, khong sua/xoa `hr_monthly_roster_items` goc.
- Export Excel thang/nam dung cung projection backend.
- UI `/manager/hr/rosters` bo nut tao thang, bo trang thai chot/mo, hien copy "tu dong tinh".
- UI chi tiet danh sach thang bo `Mo ky`, `Chot thang`, `Mo lai`.
- UI `Tang/Giam` giai thich ro rang ngay hieu luc se cap nhat thang do va cac thang sau.

### 3.3. Dieu chua lam trong Phase 8

- Chua deploy/restart production.
- Chua browser UAT tren runtime that.
- Chua them field `reported_date` hoac `late_report_reason`.
- Chua co preview anh huong truoc khi confirm.
- Chua co flow dieu chinh/dao chieu movement da confirmed.
- Chua co reconciliation doc lap tren database runtime.

## 4. Phase 9 - Hoan thien UX dieu chinh bien dong

Muc tieu Phase 9 la lam cho Manager thao tac an toan hon khi du lieu da xac nhan bi nhap sai.

Du kien:

- Man `Tang/Giam` co preview anh huong truoc khi confirm.
- Preview hien cac thang se thay doi va quan so moi.
- Them `Ngay don vi bao cao` neu TCHC can theo doi bao tre.
- Neu movement da confirmed bi sai, khong xoa cung; dung flow `Dieu chinh bien dong`.
- Lich su bien dong hien ro movement nao la ban dieu chinh/dao chieu.
- Danh sach thang co the hien "duoc tinh tu bao nhieu bien dong".
- Search/filter/sort/page tiep tuc chay tu backend.
- Giao dien responsive desktop, Android va iOS PWA.

## 5. Phase 10 - Doi soat, UAT va rollout

Muc tieu Phase 10 la khoa chat so lieu truoc khi dung that rong hon.

Case UAT bat buoc:

1. Tang trong T6 lam T6 va T7 tang.
2. Giam trong T6 lam T6 va T7 giam.
3. Giam trong T7 chi lam T7 giam, T6 khong doi.
4. Tang roi giam cung mot nhan su, timeline tinh dung.
5. Thang hien tai tu dong xuat hien khong can bam tao.
6. Export thang khop UI thang do.
7. Export nam khop UI tung thang da co du lieu.
8. Non-Manager nhan `403`, khong token nhan `401`.
9. Confirmed movement khong xoa cung.
10. Audit co actor/thoi diem/ly do nhung khong log PII nhay cam.

Hardening:

- Kiem tra N+1 query projection.
- Them index neu EXPLAIN tren MySQL runtime can.
- Backup/restore truoc rollout.
- Chay reconciliation read-only tren database clone.
- Chi rollout khi nguoi dung cho phep.

## 6. Ngoai pham vi hien tai

- Khong lam lai ngay phep.
- Khong trien khai Booking.
- Khong xoa legacy Booking code/table.
- Khong xoa du lieu nhan su.
- Kho giay to nhan su, bao cao nang cao va canh bao ho so de backlog sau khi danh sach thang on dinh.
