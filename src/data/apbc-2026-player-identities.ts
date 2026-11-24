import { buildNpbInternationalIdentityEvidence, kanemaruNpbIdentityReview } from "./international-npb-player-identities";

export const apbc2026Id = "international:tournament:apbc:2026";
const reviewedAt = "2026-11-24T12:19:00Z";
const batteriesReviewedAt = "2026-11-24T12:34:00Z";

// Japanese Wikipedia contributors (fixed player article revisions, CC BY-SA 4.0) and
// the Chadwick Baseball Bureau Register (ODC-BY 1.0). Only the exact matching IDs are used.
const reviewedPlayers = [
  // 髙橋宏斗
  [4251765, 111782428, "61265153", "85cf36a2-6dc5-4612-9969-0d9d6eca626c",
    "784a5f12-6e6a-4555-8570-8bbf37066792", "cf7c13b2a4b9da534a8e2907af6f215a3c1d8fe66e20916b9056df3576c01cc7"],
  // 正木智也
  [4450526, 111804472, "81885155", "2b2a8d97-2a6e-441c-9a33-0d79d2a7d147",
    "197db3cb-d211-45f4-926a-9bdab2f9540d", "89fe09ca7d0615bafbd2dd8a99f64d070f365fb3f17168bdf35b88c11b27b2f1"],
  // 森田駿哉
  [4847158, 111849866, "43345159", "18f28f0f-a0b1-4970-aa9a-cce98530eac8",
    "df09c07a-6daa-4851-81fb-8d609c7d22d4", "c90abe5058894a64602e2c9b2c4f81a0f609eb73f6fbd92ed1afa9313f211570"],
  // 髙太一
  [4847462, 111886451, "41045159", "b3179a2e-4de3-4a68-a624-2b1f6ae87911",
    "406ef87c-f492-4172-822b-710fc9f3e9e9", "974944152cb03318f1d86778a654f7c3e6c5dabec03957723abe0ed3fa16a3b7"],
  kanemaruNpbIdentityReview.row,
  // 宗山塁
  [4980856, 111833176, "53155150", "b6286dd6-cf1f-45b8-87e2-95433f8aadb0",
    "7a1b21f2-4cbf-457c-a3d7-7469284d28ef", "5869814f23e1e658764f1b6470bace6959abdf9082ccbc70ffef3c5df6f36be8"],
  // 西川史礁
  [4989301, 111806605, "21625150", "e7733422-2213-46f8-9b5f-4d12cf85c086",
    "b05094ea-3130-488e-a3bb-591157c4c87f", "fe3ee4441e50eb29bd8931557dda16b35cdcad3b4f20c38dc321e683fbe59dda"],
  // 渡部聖弥
  [4989729, 111782502, "83385150", "f19b2b9d-b148-4aee-9378-18fd5ad155fd",
    "49ef749d-3911-435d-8249-24ebf88bb524", "8abdcdf3b45eb6f28cb631559b9395d92621f7c498ff493409d77bcac5ee0f3a"],
  // 小島大河
  [5156099, 111782486, "41745152", "ae44f92d-c4be-4d52-a5ab-aa44f323b67b",
    "710cd9d2-e9f0-4578-a506-7642a91a6a4b", "bc54f7e8b21f3af84d6fe91fe25fae7db3bc0b222992d1bed1873d02feaedae1"],
] as const;

const reviewedBatteryPlayers = [
  // 松本健吾
  [4037049, 111782450, "03105159", "d9858b61-9279-452c-88f5-9f86da6f9508",
    "df80bb95-4649-43db-b98f-c4f0ee5195e4", "87c181ca5bd68a471ed4ab47df5450824dc443afea23b61663b2cc472fbe17a7"],
  // 中森俊介
  [4274936, 111782477, "31635153", "4aa427af-2c24-4f42-aeef-dbaa932e2cb0",
    "252d0578-2605-4a36-b31d-586208662513", "f1edf6c3251ef1c413ac255c6d34fa8f4b8c83b786fd78cbf8f8599ebff124fa"],
  // 松尾汐恩
  [4666647, 111782481, "21825157", "6149126a-d80f-42bf-899b-89b83c7f7516",
    "82189ce2-d6a4-45d3-810b-19b25d73340f", "aaec22175d483a2b3bb8f1948c33e7147f67e5144d32d64f810e0caddaf149c2"],
  // 武内夏暉
  [4832529, 111782412, "51255159", "6c571e31-d07d-4cb5-9c1c-a9ea83a653e5",
    "d4f1f342-f51a-4b2b-a14d-711a1af549c7", "2f02e0dcabff07adfb6002df1f9e9243246dee68e284420d4f4a23d42655acec"],
  // 進藤勇也
  [4847310, 111782491, "11015159", "8e8fcecf-182b-4649-b245-941a7533fc05",
    "b8af6bbe-348c-4d00-85f8-9fb5e66f6d98", "6270e64d70420d92184a74994da7cc8c2c868045e66afb12d28ad194e0f04d40"],
  // 石田裕太郎
  [4859137, 111782409, "21125159", "b15a7a83-4735-4c80-803f-aed9cdf5ad01",
    "d614a142-7bb2-4398-83e7-4dca288ae8eb", "178c57f5a1b025aae883450970cd145d9c44cc5d4ae857b43fdfcf2758cae574"],
  // 吉田聖弥
  [4993682, 111782398, "93395150", "e32fd9dc-8f4c-474e-9aa3-ef86927a1839",
    "35c46446-bf42-4bb3-99c5-9de2757c8076", "e368052349c6cdda45c485c9109b2e5ea2bb6736dac0c2b44ca9ada8b922ef5d"],
  // 篠原響
  [4997978, 111782470, "61065150", "8f500d17-ab40-43ca-a77e-73bc35994e31",
    "702859ee-1f46-4be3-bb6b-4c5a8fb48dfb", "dffaba17e37234802c8ffb5cc2a781f27c4c91786d80f165eed26cd5279ff53b"],
  // 九谷瑠
  [5144198, 111855641, "71775152", "8670686b-34c8-40d7-87db-ddddcbfd7d3a",
    "62ced270-4d97-489f-98bd-93a503e43baa", "fa5490c1a16ca17b44fcd984c623cbebe7f5ead795559ba1d111e98ed6e438a0"],
  // 鈴木豪太
  [5161252, 111825019, "21025152", "457bd818-735c-4bd6-9dcd-c5c677b6d64a",
    "7b15b81a-46a4-4878-b5d6-44ec03b177bb", "41410ee85a050b1611e711fc1ea84ff814e2ba9de242d401d0e784491b6962d7"],
  // 竹丸和幸
  [5169029, 111782402, "71275152", "0b28d983-d75c-49df-b4a4-ecd57ebba488",
    "abb6ee75-a800-49f6-a673-a04e321f0986", "eba3a3195d15dc211b2d3dbf4ba74ec64ca1e3dae5ef4886be8e08ee48ca692a"],
] as const;

const identityReviews = [
  ...reviewedPlayers.map(row => ({ row, reviewDate: reviewedAt })),
  ...reviewedBatteryPlayers.map(row => ({ row, reviewDate: batteriesReviewedAt })),
];

export const { sources: apbcIdentitySources, identities: apbcIdentities } = buildNpbInternationalIdentityEvidence(identityReviews);
