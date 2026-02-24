import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
      default: ''
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    mediaUrl: {
      type: String,
      required: true
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public'
    }
  },
  {
    timestamps: true
  }
);

assetSchema.index({ visibility: 1, createdAt: -1 });
assetSchema.index({ owner: 1, createdAt: -1 });

const Asset = mongoose.model('Asset', assetSchema);

export default Asset;
